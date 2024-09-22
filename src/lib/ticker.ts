import {setTimer} from "azle";
import * as bitcoin_api from "./bitcoin_api";
import * as stable_storage from "./db";
import * as tap_api from "./tap_api";
import * as incoming from "./incoming";
import * as queue from "./queue";
import {START_BLOCK} from "../config";

let queue_tick_cnt = 0;

/**
 * The queueTick() function processes logs that are being created with functions and their messages in lib/incoming.ts
 * Unlike blockTick(), these aren't tied to specific blocks or transaction order as the logs are verified already
 * and just awaiting signatures (for reedeems, privileges and actual bitcoin transactions).
 */
export function queueTick()
{
    let delay = 1n;

    setTimer(delay, async () => {

        queue_tick_cnt += 1;

        if(false === stable_storage.dbContainsKey('queue_next_log'))
        {
            stable_storage.dbPut('queue_next_log', 0);
        }

        if(false === stable_storage.dbContainsKey('log_n'))
        {
            stable_storage.dbPut('log_n', 0);
        }

        if(false === stable_storage.dbContainsKey('queue'))
        {
            stable_storage.dbPut('queue', 0);
        }

        console.log('queue_tick_cnt', queue_tick_cnt);
        stable_storage.dbPut('queue_tick_cnt', queue_tick_cnt);

        const queue_length = stable_storage.dbGet('queue');

        console.log('Queue Length', queue_length);

        if(queue_length === 0)
        {
            try
            {
                let curr_queue = [];
                const queue_max = 20;
                const curr = stable_storage.dbGet('queue_next_log');
                const length = stable_storage.dbGet('log_n');

                console.log('ABOUT TO ENTER QUEUE LOOP', curr, length);

                // If there are more than 200 log entries that need processing, then we signal that the canister is busy.
                // Beyond this threshold, it's getting more and more unlikely to get the logs processed with the Bitcoin avg. block time of 10 minutes.
                // Clients should know about this and can decide if they step away until not busy anymore or take the risk themselves.
                if(length - curr > 200)
                {
                    stable_storage.dbPut('busy', true);
                }
                else
                {
                    stable_storage.dbPut('busy', false);
                }

                for(let i = curr; i < length; i++)
                {
                    if(curr_queue.length + 1 >= queue_max)
                    {
                        break;
                    }

                    let queueable = null;
                    const log_entry = stable_storage.dbGet('log_'+i);

                    if(typeof log_entry.proc === 'undefined' || true === log_entry.proc)
                    {
                        continue;
                    }

                    if (!stable_storage.dbContainsKey('curr_utxos'))
                    {
                        stable_storage.dbPut('curr_utxos', []);
                    }

                    if (!stable_storage.dbContainsKey('curr_utxos_value'))
                    {
                        stable_storage.dbPut('curr_utxos_value', 0);
                    }

                    let curr_utxos = stable_storage.dbGet('curr_utxos');

                    if(await queue.isLogEntryTransactable(log_entry))
                    {
                        let curr_utxos_value = stable_storage.dbGet('curr_utxos_value');

                        console.log('CURR UTXOS VALUE', curr_utxos_value);

                        // should the current ordered utxo values not make up for the costs, we gonna try to find more from the actual canister and update those.
                        if(curr_utxos_value < Number(log_entry.sats) + Number(log_entry.fee))
                        {
                            const the_utxos = await bitcoin_api.getUtxos(bitcoin_api.CANISTER_BITCOIN_ADDRESS);

                            if(the_utxos.utxos.length === 0)
                            {
                                throw new Error('No UTXOs found.');
                            }

                            for(let j = 0; j < the_utxos.utxos.length; j++)
                            {
                                const tx = Buffer.from(the_utxos.utxos[j].outpoint.txid).toString('hex');
                                const vo = the_utxos.utxos[j].outpoint.vout;
                                const val = the_utxos.utxos[j].value;

                                if (false === stable_storage.dbContainsKey('curr_utxos_index_'+tx+':'+vo))
                                {
                                    await bitcoin_api.storeUtxo({ tx, vo , val });
                                }
                            }

                            curr_utxos = stable_storage.dbGet('curr_utxos');
                            curr_utxos_value = stable_storage.dbGet('curr_utxos_value');

                            if(curr_utxos_value < Number(log_entry.sats) + Number(log_entry.fee))
                            {
                                throw new Error('Could not find enough utxos. Need more.');
                            }
                        }

                        // pre-emptively simulating spent utxos. the exact same will be selected in the processor below.
                        const predicted_utxos_transaction = bitcoin_api.buildTransactionWithFee(
                            curr_utxos,
                            bitcoin_api.CANISTER_BITCOIN_ADDRESS,
                            log_entry.addr,
                            BigInt(log_entry.sats),
                            BigInt(log_entry.fee)
                        );

                        const inputs = predicted_utxos_transaction.txInputs;

                        if(inputs.length > 10)
                        {
                            throw new Error('Too many inputs. Need more higher value utxos.');
                        }

                        // clean pre-emptively spent utxo from the curr_utxos set
                        for(let j = 0; j < inputs.length; j++)
                        {
                            console.log('DELETING UTXO', inputs[j].hash.toString('hex'), inputs[j].index);
                            await bitcoin_api.deleteUtxo(inputs[j].hash.toString('hex'), inputs[j].index);
                        }
                    }

                    // since we removed the pre-emptively spent utxos, we can now afford parallel processor calls to work on the current log entry.
                    // note the missing "await", will be fulfilled further below.
                    queueable = queue.process(log_entry, 'log_'+i, curr_utxos);

                    if(queueable !== null)
                    {
                        const tmp_length = stable_storage.dbGet('queue');
                        stable_storage.dbPut('queue', tmp_length + 1);
                        curr_queue.push(queueable);
                    }
                }

                if(curr_queue.length !== 0)
                {
                    const results = await Promise.allSettled(curr_queue);
                    const errors = results.filter((result) => result.status === "rejected");

                    const fulfilled = results
                        .filter((result) => result.status === "fulfilled")
                        .map((result) => result.value);

                    console.log("FULFILLED", fulfilled);
                    console.log("ERRORS", errors);

                    for(let j = 0; j < fulfilled.length; j++)
                    {
                        const fulfilled_obj = fulfilled[j];

                        console.log('OBJ FULFILLED', fulfilled_obj);

                        if(typeof fulfilled_obj.ref === 'string')
                        {
                            console.log('ENTERING FULFILLED');

                            if(false === stable_storage.dbContainsKey(fulfilled_obj.ref))
                            {
                                console.log('FAILED REF', fulfilled_obj);
                                continue;
                            }

                            const update_obj = stable_storage.dbGet(fulfilled_obj.ref);
                            update_obj.proc = true;
                            update_obj.dta = fulfilled[j];
                            stable_storage.dbPut(fulfilled_obj.ref, update_obj);

                            console.log('Updated queue', update_obj);
                        }
                    }

                    // we consider the current log batch being processed if there is no failure.
                    // failures at this point will be critical and should keep retrying until admins solve problems.
                    if(errors.length === 0)
                    {
                        stable_storage.dbPut('queue_next_log', curr + curr_queue.length);
                    }
                    else
                    {
                        console.log('Queue errors', errors);
                        stable_storage.dbPut('queue_debug', errors.toString());
                    }

                    stable_storage.dbPut('queue', 0);
                }
                else
                {
                    stable_storage.dbPut('queue_next_log', length);
                }
            }
            catch(e)
            {
                console.log(e);
                stable_storage.dbPut('queue_debug', e.toString());
            }
        }

        queueTick();
    });
}

/**
 * Main block related execution method for this tap-protocol liquidity-pool canister.
 *
 * export function blockTick() is supposed to loop over new bitcoin blocks with the help of the tap reader (indexed tap data).
 * It detects incoming assets as well as incoming requests (liquidity add/extract, buy, sell).
 *
 * Based on the requests, export function block_tick()() either controls the issuance of signed asset distribution for tap protocol assets
 * and / or sends bitcoin.
 *
 * export function blockTick() tries to be as resilient against errors (especially http outcall errors) as possible. Means, that it will
 * retry to index a block if it fails for reasons not under control of the canister. This also means that all stable
 * mem writes must only happen if no error is to be expected (with a few exceptions like registering new token metadata).
 */
export function blockTick()
{
    let delay = bitcoin_api.key_id === 'key_1' ? 60n : 1n;

    // process the current ticker loop
    setTimer(delay, async () => {

        //stable_storage.dbPut('debug', '');

        try
        {
            // we cannot initialize cached addresses and pubkeys in init() and update(),
            // so we keep it here for the time being.
            if(bitcoin_api.CANISTER_BITCOIN_ADDRESS === '')
            {
                await bitcoin_api.getCanisterAddress();
            }

            if(bitcoin_api.CANISTER_BITCOIN_PUBKEY === '')
            {
                await bitcoin_api.getCanisterPubkey();
            }

            if(false === stable_storage.dbContainsKey('currentBlock'))
            {
                stable_storage.dbPut('currentBlock', START_BLOCK);
            }

            const current_block = stable_storage.dbGet('currentBlock');

            // keeping a re-org safe distance of 3 blocks
            const updated_block = await tap_api.updatedBlock() // TODO: enable block distance - 3;

            if(typeof updated_block.err !== 'undefined' || current_block === null)
            {
                throw new Error(tap_api.apiErrorMsg(updated_block));
            }

            const block_diff = updated_block - current_block;

            // in case we need to catch up, we go faster
            if(block_diff >= 2)
            {
                delay = 1n;
            }
            else
            {
                delay = 10n;
            }

            console.log('CURRENT BLOCK', current_block, 'UPDATED BLOCK', updated_block);

            stable_storage.dbPut('block_diff', 'current ' + current_block + ' updated: ' + updated_block + ' diff: ' + block_diff);

            // index each new block since the recent updated one
            // the block loop handles incoming liquidity, liquidity extraction as well as buying and selling.
            for(let i = 0; i < block_diff; i++)
            {
                const block = (updated_block - block_diff) + i + 1;

                console.log('TRYING NEXT BLOCK', block);

                // retrieve unprocessed tap token requests for this canister's btc address
                await incoming.processMintMessage(block);

                stable_storage.dbPut('currentBlock', block);
            }
        }
        catch(e)
        {
            // retry on next tick
            console.log(e);
            stable_storage.dbPut('debug', e.toString());
        }

        blockTick();
    });
}