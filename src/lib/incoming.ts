import * as tap_api from "./tap_api";
import * as stable_storage from "./db";
import * as bitcoin_api from './bitcoin_api';

/**
 * This is an example of how to accept messages and sats (money) for this canister.
 * Depending on the message being sent in the inscription's dta field, custom actions may be performed.
 *
 * Minting is a nice trick to allow for single-transaction messages and processing, but if provenance is required,
 * token-transfer is recommended to be used (With token-transfer, we can determine if the transaction was done by
 * specific sender the message processing is meant for).
 *
 * @param block
 */
export async function processMintMessage(block : number)
{
    // to prevent re-processing of the same block for this incoming function, we check if it got processed already
    if(true === stable_storage.dbContainsKey('bp_processmint_' + block))
    {
        return;
    }

    // retrieving all relevant mints from the tap protocol (through tap reader as oracle)
    // the mint is limited to a specifc ticker that can never really mint out (extremely high supply).
    // check tapSwapMintLength() and tapSwapMint() for details.
    const deposits_length = await tap_api.tapSwapMintLength(block);

    if(typeof deposits_length.err !== 'undefined' || deposits_length === null)
    {
        throw new Error(tap_api.apiErrorMsg(deposits_length));
    }

    const deposits = await tap_api.tapSwapMints(block, BigInt(''+deposits_length));

    // in case or errors from the API we throw to force the queues in ticker.ts to retry.
    // under no circumstances should API error messages lead to a procssed message!
    if(typeof deposits.err !== 'undefined' || deposits === null)
    {
        throw new Error(tap_api.apiErrorMsg(deposits));
    }

    // iterating through all deposited mints into our canister
    for(let j = 0; j < deposits.length; j++)
    {
        console.log('MINT DEPOSIT', deposits[j]);

        // verifying the structure of the incoming mint
        if (deposits[j].addr === bitcoin_api.CANISTER_BITCOIN_ADDRESS && // making sure the mint message is addressed to the canister
            deposits[j].blck === block && // ofc, this must be a message for the current block we are processing
            deposits[j].fail === false && // the mint message from the tap reader must indicate to be a valid mint
            typeof deposits[j].dta === "string" && // the dta string is required
            BigInt(deposits[j].amt) > 0n) // ofc, the amount of the mint must be > 0
        {
            let dta_success = false;
            let to_address = null;
            let sats_fee = 0n;

            // any error happening with processing the dta field should be caught, so we can continue with the next iteration of the loop.
            try
            {
               const data = JSON.parse(deposits[j].dta);

               // the dta structure assumes a custom "processMint" operation the existence of a bitcoin address to send funds/refunds, to.
               // we are also making it a requirement for the client to let us know how much of the sats postage is for paying fees (in this case used if there are refunds).
               if(typeof data.op === 'string' &&
                   typeof data.addr === 'string' &&
                   typeof data.fee === 'number' &&
                   data.op === 'processMint' &&
                   data.fee > 0 &&
                   data.fee <= Number.MAX_SAFE_INTEGER &&
                   bitcoin_api.isValidBitcoinAddress(data.addr))
               {
                   // do something and mark as success
                   dta_success = true;
                   to_address = data.addr;
               }
            }
            catch(e) {}

            // subtracting the fee information given with the dta field from the postage to have both separated for later use.
            const sats = BigInt(deposits[j].val) - sats_fee;

            // if the dta_success fails, we treat this transaction like sending money to a contract (basically lost)
            if(false === dta_success)
            {
                continue;
            }

            // recording the utxo is absolutely recommended
            const utxo = 'vo_' + deposits[j].tx + ':' + deposits[j].vo;

            // ... if the dta message was structured as planned, we create a refund object.
            // this refund object signals the ticker.queueTick() function to return tokens / and or btc.
            // allo logs, also the logs for refund objects, are processed in lib/queue.ts and need to address each "type" given.
            // see below
            const refund_object = {
                type : 'btcRefund', // signals a btc refund. required.
                addr: to_address !== null ? to_address : null, // the address to send the refund to. required.
                sats : sats.toString(), // how many sats to return (postage - fee). required for logs that should handle btc, see lib/queue.ts
                fee : sats_fee.toString(), // the fees to use for potential refunds. required for logs that should handle btc, see lib/queue.ts
                blck : block, // the current block being processed. required.
                utxo : utxo, // the utxo being used. required.
                ins : deposits[j].ins, // the inscrikption id (not number). required.
                proc : false, // processed? false by default and is set by the log processor. required.
                dta: null // additional dta field for internal use. should be null by default and is required.
            };

            // to prevent re-processing of the same utxo, we check if it got processed already
            if (false === stable_storage.dbContainsKey(utxo))
            {
                // storing the utxo set to re-use later for sending btc from the logs processor in ticker.ts
                bitcoin_api.storeUtxo(deposits[j]);

                // now we can implement our custom logic for this message.
                // in the case below we assume an issue with something that should be stored in the key/value database but isn't.
                // this means we cannot proceed and we'll issue a refund and stop processing by requesting the next iteration.
                if (false === stable_storage.dbContainsKey('this db key does not exist!'))
                {
                    console.log('Something does not exist!');
                    await stable_storage.addRefundLog(refund_object);
                    continue;
                }

                // let's assume everything is fine and write another log that is supposed to
                // send the minted tokens for this canister, to the given address of the dta field
                const log_entry = {
                    type : 'mintMessage',
                    tick : tap_api.MINT_TICK,
                    // we usually would check the tap reader to ask for the decimals if that was supposed to be for generic tokens:
                    dec  : 18,
                    addr: to_address,
                    // we just send the minted amount back to the address (addr) given in the dta field:
                    amt: deposits[j].amt,
                    // and also sending back remaining sats that are not supposed to be part of fees:
                    sats : sats.toString(),
                    // the fee is extremely important for sending actual btc:
                    fee : sats_fee.toString(),
                    blck : block,
                    utxo : utxo,
                    ins : deposits[j].ins,
                    proc : false,
                    dta: null
                };

                console.log(log_entry);

                // we only store logs once all checks have passed and there are no errors at all!
                const ref = await stable_storage.addLog(log_entry);

                // storing a reference for the utxo being used.
                // this is useful for clients (wallets) to find the associated logs with their transactions.
                if(ref !== null)
                {
                    await stable_storage.addRef(utxo, ref);
                }

                // marking this utxo as processed
                stable_storage.dbPut(utxo, '');

                console.log('MINT DEPOSIT COMPLETED', j);
            }
        }
    }

    // marking this block as processed for THIS function
    stable_storage.dbPut('bp_processmint_' + block, '');
}