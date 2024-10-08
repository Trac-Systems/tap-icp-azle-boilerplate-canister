import { ec } from 'elliptic';
import { publicKeyToAddress } from 'viem/accounts';
import {IDL, call} from "azle";
import * as eth_rpc from "./eth_rpc";
import * as config from "../config";

export let CANISTER_ETHEREUM_ADDRESS = '';

const ETHEREUM_REFUNDABLE = 10_000_000n * 34n * 1n;

const ETHEREUM_RECEIPT_COST = ((
        5_912_000n
        + 60_000n * 34n // Number of nodes in the subnet
        + 2400n * 2048n // Size of the HTTP request in bytes
        + 800n * 8192n // Maximum HTTP response size in bytes
    ) * 34n
    * 1n) + ETHEREUM_REFUNDABLE;

const ETHEREUM_BLOCKS_COST = ((
        5_912_000n
        + 60_000n * 34n // Number of nodes in the subnet
        + 2400n * 2048n // Size of the HTTP request in bytes
        + 800n * 8192n // Maximum HTTP response size in bytes
    ) * 34n
    * 3n) + ETHEREUM_REFUNDABLE;

const ETHEREUM_GETBLOCK_COST = ((
        5_912_000n
        + 60_000n * 34n // Number of nodes in the subnet
        + 2400n * 1024n // Size of the HTTP request in bytes
        + 800n * 1024n // Maximum HTTP response size in bytes
    ) * 34n
    * 1n) + ETHEREUM_REFUNDABLE;

export const icpPubToAddress = async (publicKey: string): Promise<string>  => {
    const key = new ec('secp256k1').keyFromPublic(Buffer.from(publicKey, 'hex'), 'hex');
    const pointBytes = key.getPublic(false, 'hex');
    CANISTER_ETHEREUM_ADDRESS = publicKeyToAddress(`0x${pointBytes}`).toString();
    return CANISTER_ETHEREUM_ADDRESS;
}

export async function getEthereumTransactionReceipt(txhash)
{
    const response = await call('7hfb6-caaaa-aaaar-qadga-cai', 'eth_getTransactionReceipt', {
        paramIdlTypes: [eth_rpc.RpcServices, IDL.Opt(eth_rpc.RpcConfig), IDL.Text],
        returnIdlType: eth_rpc.MultiGetTransactionReceiptResult,
        args: [
            config.ethRpcMulti,
            [
                {
                    responseSizeEstimate : [8192n]
                }
            ],
            txhash
        ],
        payment : ETHEREUM_RECEIPT_COST
    });

    if(typeof response.Consistent !== 'undefined' &&
        typeof response.Consistent.Ok !== 'undefined' &&
        response.Consistent.Ok.length >= 1)
    {
        const parsed_value = response.Consistent.Ok[0];

        console.log('RESPONSE JSON eth_getTransactionReceipt', parsed_value);

        return parsed_value;
    }

    throw new Error('Invalid eth_getTransactionReceipt result.');
}

export async function getEthereumBlockNumber()
{
    const response = await call('7hfb6-caaaa-aaaar-qadga-cai', 'request', {
        paramIdlTypes: [eth_rpc.RpcService, IDL.Text, IDL.Nat64],
        returnIdlType: eth_rpc.RequestResult,
        args: [
            config.ethRpcSingle,
            '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}',
            1024n
        ],
        payment : ETHEREUM_GETBLOCK_COST
    });

    if(typeof response.Ok !== 'undefined')
    {
        const parsed_value = JSON.parse(response.Ok);

        console.log('RESPONSE JSON eth_blockNumber', parsed_value);

        if(typeof parsed_value.result !== 'undefined')
        {
            return parseInt(parsed_value.result.replace('0x', ''), 16);
        }
    }

    throw new Error('Invalid eth_blockNumber result.');
}

export async function getEthereumBlockByNumber()
{
    const response = await call('7hfb6-caaaa-aaaar-qadga-cai', 'eth_getBlockByNumber', {
        paramIdlTypes: [eth_rpc.RpcServices, IDL.Opt(eth_rpc.RpcConfig), eth_rpc.BlockTag],
        returnIdlType: eth_rpc.MultiGetBlockByNumberResult,
        args: [
            config.ethRpcMulti,
            [
                {
                    responseSizeEstimate : [8192n]
                }
            ],
            {
                Finalized : null
            }
        ],
        payment : ETHEREUM_BLOCKS_COST
    });

    return response;
}

export function isValidHash(hash)
{
    return /^0x([A-Fa-f0-9]{64})$/.test(hash);
}