import * as bitcoin_api from './lib/bitcoin_api';
import * as eth_api from './lib/eth_api';
import {queueTick, bitcoinBlockTick, ethereumBlockTick} from './lib/ticker';
import * as tap_auth from './lib/tap_auth';
import * as stable_storage from './lib/db';
import {IDL, query, update, init, postUpgrade} from 'azle';
import {TOKEN_AUTH_INSCRIPTION, ETH_FINALITY_DISTANCE, BITCOIN_FINALITY_DISTANCE, PRIVILEGE_AUTH_INSCRIPTION} from "./config";
import {
    GetUtxosResult,
    MillisatoshiPerByte,
    HttpResponse,
    HttpTransformArgs
} from 'azle/canisters/management';
import {signCreateVoucher} from "./lib/tap_auth";

/**
 * Main entry class for this ICP canister.
 *
 * Please see the azle book for options:
 *
 * https://demergent-labs.github.io/azle/
 *
 * A great compendium is also the examples and especially the test cases from the AZLE repo:
 *
 * https://github.com/demergent-labs/azle
 */
export default class{
    @init([])
    init(): void {
        bitcoinBlockTick();
        ethereumBlockTick();
        queueTick();
    }

    @postUpgrade([])
    postUpgrade(): void {
        bitcoinBlockTick();
        ethereumBlockTick();
        queueTick();
    }

    @query([HttpTransformArgs], HttpResponse)
    xkcdTransform(args) {
        return {
            ...args.response,
            headers: []
        };
    }

    @query([IDL.Text], IDL.Text)
    async dbGet(key)
    {
        if(stable_storage.dbContainsKey(key))
        {
            return JSON.stringify(stable_storage.dbGet(key));
        }

        return '';
    }

    @query([IDL.Text, IDL.Nat32], IDL.Text)
    getLogByUtxo(tx, vout)
    {
        if(stable_storage.dbContainsKey('ref_vo_'+tx+':'+vout)) {
            const ref = stable_storage.dbGet('ref_vo_'+tx+':'+vout);

            if(stable_storage.dbContainsKey(ref)) {
                return JSON.stringify(stable_storage.dbGet(ref));
            }
        }
        return JSON.stringify(null);
    }

    @query([IDL.Nat32, IDL.Nat32], IDL.Text)
    getLogs(offset, max)
    {
        let max_length = 0;

        if(stable_storage.dbContainsKey('log_n')) {
            max_length = stable_storage.dbGet('log_n');
        }

        const length = max;

        if(offset < 0 || length < 0)
        {
            return JSON.stringify([]);
        }

        if(length > 100)
        {
            return JSON.stringify("You are trying to retrieve more than 100 results.");
        }

        const out = [];

        for(let index = offset; index < index + max && index < max_length; index++)
        {
            if(stable_storage.dbContainsKey('log_'+index)) {
                out.push(stable_storage.dbGet('log_'+index));
            }
        }

        return JSON.stringify(out);
    }

    @query([IDL.Nat32], IDL.Text)
    getLog(i)
    {
        if(stable_storage.dbContainsKey('log_'+i)) {
            return JSON.stringify(stable_storage.dbGet('log_'+i));
        }
        return JSON.stringify(null);
    }

    @query([], IDL.Nat32)
    getLogsSize()
    {
        if(stable_storage.dbContainsKey('log_n')) {
            return stable_storage.dbGet('log_n');
        }
        return 0;
    }

    @query([], IDL.Nat32)
    getLatestProcessedBitcoinBlock()
    {
        if(stable_storage.dbContainsKey('currentBlock')) {
            return stable_storage.dbGet('currentBlock');
        }
        return 0;
    }

    @query([], IDL.Nat32)
    getLatestProcessedEthereumBlock()
    {
        if(stable_storage.dbContainsKey('currentEthBlock')) {
            return stable_storage.dbGet('currentEthBlock');
        }
        return 0;
    }

    @query([], IDL.Bool)
    getIsBusy()
    {
        let busy = false;
        let eth_busy = false;

        if(stable_storage.dbContainsKey('busy')) {
            busy =  stable_storage.dbGet('busy');
        }

        if(stable_storage.dbContainsKey('eth_busy')) {
            eth_busy =  stable_storage.dbGet('eth_busy');
        }

        return busy || eth_busy;
    }

    @query([], IDL.Text)
    getCanisterTokenAuthority()
    {
        return TOKEN_AUTH_INSCRIPTION;
    }

    @query([], IDL.Text)
    getCanisterPrivilegeAuthority()
    {
        return PRIVILEGE_AUTH_INSCRIPTION;
    }

    @query([], IDL.Text)
    getCanisterPubkey()
    {
        return bitcoin_api.CANISTER_BITCOIN_PUBKEY;
    }

    @query([], IDL.Text)
    getCanisterBitcoinAddress()
    {
        return bitcoin_api.CANISTER_BITCOIN_ADDRESS;
    }

    @query([], IDL.Text)
    getCanisterEthereumAddress()
    {
        return eth_api.CANISTER_ETHEREUM_ADDRESS;
    }

    @query([], IDL.Nat32)
    getBitcoinFinalityBlocks()
    {
        return BITCOIN_FINALITY_DISTANCE;
    }

    @query([], IDL.Nat32)
    getEthereumFinalityBlocks()
    {
        return ETH_FINALITY_DISTANCE;
    }

    /**
     * The following below should be removed before announcing the location of this canister.
     * Just upgrade the canister with the below removed once your canister goes live.
     * This should be done to prevent cycle drainage through update calls.
     */

    @update([], IDL.Nat32)
    async getEthereumBlockNumber()
    {
        return await eth_api.getEthereumBlockNumber();
    }

    @update([IDL.Text, IDL.Nat32, IDL.Nat32], IDL.Text)
    async tap(txid, vout, value)
    {
        let out = null;

        try
        {
            out = await tap_auth.tap(txid, vout, value);
        }
        catch(e)
        {
            stable_storage.dbPut('debug', e.message.toString());
        }

        return out;
    }

    @update([IDL.Text], IDL.Text)
    async signWithECDSA (messageHash)
    {
        return await bitcoin_api.signHashWithECDSA(messageHash);
    }

    @update([], IDL.Text)
    async signCreateTokenAuthority()
    {
        return await tap_auth.signCreateTokenAuthority();
    }

    @update([], IDL.Text)
    async signCreatePrivilegeAuthority()
    {
        return await tap_auth.signCreatePrivilegeAuthority();
    }

    @update([], IDL.Vec(MillisatoshiPerByte))
    async getCurrentFeePercentiles()
    {
        return await bitcoin_api.getCurrentFeePercentiles();
    }

    @update([IDL.Text], GetUtxosResult)
    async getUtxos (address)
    {
        return await bitcoin_api.getUtxos(address);
    }

    @update([IDL.Text, IDL.Nat, IDL.Text, IDL.Text], IDL.Text)
    async generateMintVoucherDebug(tick : string, amt : bigint, address : string, ethAddress : string) {
        return await signCreateVoucher({ tick, amt, address, ethAddress });
    }

    @update([IDL.Text], IDL.Text)
    async getEthereumTransactionReceipt(txhash)
    {
        return JSON.stringify(await eth_api.getEthereumTransactionReceipt(txhash), (_, v) => typeof v === 'bigint' ? v.toString() : v);
    }
}
