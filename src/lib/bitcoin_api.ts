import {networks, Transaction} from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { ValidateSigFunction } from 'bitcoinjs-lib/src/psbt';
import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import {serialize} from "azle/experimental";
import {MillisatoshiPerByte, Satoshi} from "azle/canisters/management";
import { Address } from '@cmdcode/tapscript';
import {sha256} from "js-sha256";
import * as stable_storage from "./db";
import {network} from "../config";

export const key_id = typeof network.mainnet !== 'undefined' ? 'key_1' : ( typeof network.testnet !== 'undefined' ? 'test_key_1' : 'dfx_test_key' ); // main: key_1, testnet: test_key_1, regtest: dfx_test_key
export const TAPSCRIPT_NETWORK = typeof network.mainnet !== 'undefined' ? 'main' : 'testnet'; // testnet or regtest doesnt matter

const BITCOIN_GETPERCENTILES_COST: bigint = 100_000_000n;
const BITCOIN_GETUTXOS_COST: bigint = 10_000_000_000n;
const BITCOIN_GETBALANCE_COST: bigint = 100_000_000n;
const SIGN_WITH_ECDSA_COST_CYCLES: bigint = 50_000_000_000n;
const SEND_TRANSACTION_BASE_CYCLES: bigint = 5_000_000_000n;
const SEND_TRANSACTION_PER_BYTE_CYCLES: bigint = 20_000_000n;

export type SignFun = (
    keyName: string,
    derivationPath: Uint8Array[],
    messageHash: Uint8Array
) => Promise<Uint8Array>;

export let CANISTER_BITCOIN_ADDRESS = '';
export let CANISTER_BITCOIN_PUBKEY = '';

export function validator(
    pubkey: Buffer,
    msghash: Buffer,
    signature: Buffer
): boolean {
    return ecc.verify(msghash, pubkey, signature);
}

export function mockValidator(
    _pubkey: Buffer,
    _msghash: Buffer,
    _signature: Buffer
): boolean {
    return true;
}

export async function mockSigner(
    _keyName: string,
    _derivationPath: Uint8Array[],
    _messageHash: Uint8Array
): Promise<Uint8Array> {
    // bitcoin.script.signature.encode threw away most of the signature when it was all 0s so we need to fill it up with anything besides just 0s
    return Uint8Array.from(new Array(64).fill(1));
}

export function publicKeyToP2wpkhAddress(
    publicKey: Uint8Array
): string {
    const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(publicKey),
        network: typeof network.mainnet !== 'undefined' ? networks.bitcoin : ( typeof network.testnet !== 'undefined' ? networks.testnet  : networks.regtest )
    });
    if (address === undefined) {
        throw new Error('Unable to get address from the canister');
    }
    return address;
}

export async function signTransaction(
    ownPublicKey: Uint8Array,
    transaction: bitcoin.Psbt,
    keyName: string,
    derivationPath: Uint8Array[],
    signer: SignFun,
    validator: ValidateSigFunction
): Promise<Transaction> {
    await transaction.signAllInputsAsync({
        sign: async (hashBuffer) => {
            const sec1 = await signer(
                keyName,
                derivationPath,
                Uint8Array.from(hashBuffer)
            );

            return Buffer.from(sec1);
        },
        publicKey: Buffer.from(ownPublicKey)
    });
    transaction.validateSignaturesOfAllInputs(validator);
    transaction.finalizeAllInputs();
    return transaction.extractTransaction();
}

export async function buildTransaction(
    ownPublicKey: Uint8Array,
    ownAddress: string,
    ownUtxos: Utxo[],
    dstAddress: string,
    amount: Satoshi,
    feePerByte: MillisatoshiPerByte,
    ordinal = {},
    add_burner = false
): Promise<bitcoin.Psbt> {
    // We have a chicken-and-egg problem where we need to know the length
    // of the transaction in order to compute its proper fee, but we need
    // to know the proper fee in order to figure out the inputs needed for
    // the transaction.
    //
    // We solve this problem iteratively. We start with a fee of zero, build
    // and sign a transaction, see what its size is, and then update the fee,
    // rebuild the transaction, until the fee is set to the correct amount.
    console.info('Building transaction...');
    let totalFee = 0n;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const transaction = buildTransactionWithFee(
            ownUtxos,
            ownAddress,
            dstAddress,
            amount,
            totalFee,
            ordinal,
            add_burner
        );

        // Sign the transaction. In this case, we only care about the size
        // of the signed transaction.
        const signedTransaction = await signTransaction(
            ownPublicKey,
            transaction.clone(),
            '', // mock key name
            [], // mock derivation path
            mockSigner,
            mockValidator
        );

        const signedTxBytesLen = BigInt(signedTransaction.byteLength());

        if ((signedTxBytesLen * feePerByte) / 1_000n === totalFee) {
            console.info(`Transaction built with fee ${totalFee}.`);
            return transaction;
        } else {
            totalFee = (signedTxBytesLen * feePerByte) / 1_000n;
        }
    }
}

export function buildTransactionWithFee(
    ownUtxos: Utxo[],
    ownAddress: string,
    destAddress: string,
    amount: bigint,
    fee: bigint,
    ordinal = {},
    add_burner = false
): bitcoin.Psbt {
    // Assume that any amount below this threshold is dust.
    const dustThreshold = 546n;
    const ordinal_txid = typeof ordinal.txid !== 'undefined' ? Buffer.from(ordinal.txid, 'hex').reverse() : null;
    const ordinal_vout = typeof ordinal.vout !== 'undefined' ? ordinal.vout : null;
    const ordinal_value = typeof ordinal.value !== 'undefined' ? ordinal.value : null;

    // Select which UTXOs to spend. We naively spend the oldest available UTXOs,
    // even if they were previously spent in a transaction. This isn't a
    // problem as long as at most one transaction is created per block and
    // we're using min_confirmations of 1.
    let utxosToSpend: Utxo[] = [];
    let totalSpent = 0n;
    for (const utxo of [...ownUtxos].reverse()) {
        if(typeof ordinal.txid !== 'undefined' &&
            Buffer.from(utxo.outpoint.txid).reverse().toString('hex') === ordinal.txid &&
            utxo.outpoint.vout === ordinal_vout)
        {
            continue;
        }
        totalSpent += typeof utxo.value === 'bigint' ? utxo.value : BigInt(''+utxo.value);
        utxosToSpend.push(utxo);
        if (totalSpent >= amount + fee) {
            // We have enough inputs to cover the amount we want to spend.
            break;
        }
    }

    if (totalSpent < amount + fee) {
        throw new Error(
            `Insufficient balance: ${totalSpent}, trying to transfer ${amount} satoshi with fee ${fee}`
        );
    }

    let transaction = new bitcoin.Psbt({ network : typeof network.mainnet !== 'undefined' ? networks.bitcoin : ( typeof network.testnet !== 'undefined' ? networks.testnet  : networks.regtest ) });

    if(ordinal_txid !== null && ordinal_vout !== null && ordinal_value !== null)
    {
        transaction.addInput({
            hash: ordinal_txid,
            index: ordinal_vout,
            witnessUtxo: {
                script: toOutputScript(ownAddress),
                value: Number(ordinal_value)
            }
        });
    }

    for (const utxo of utxosToSpend) {
        transaction.addInput({
            hash: Buffer.from(utxo.outpoint.txid),
            index: utxo.outpoint.vout,
            witnessUtxo: {
                script: toOutputScript(ownAddress),
                value: Number(typeof utxo.value === 'bigint' ? utxo.value : BigInt(''+utxo.value))
            }
        });
    }

    if(add_burner)
    {
        const outputScript = bitcoin.script.compile([
            bitcoin.opcodes.OP_RETURN
        ]);

        transaction.addOutput({
            script: outputScript,
            value: 0,
        });
    }

    transaction.addOutput({ address: destAddress, value: Number(amount) });

    const remainingAmount = totalSpent - amount - fee;

    if (remainingAmount >= dustThreshold) {

        transaction.addOutput({
            address: ownAddress,
            value: Number(remainingAmount)
        });
    }

    return transaction;
}

export function toOutputScript(address: string): Buffer {
    return bitcoin.address.toOutputScript(address, typeof network.mainnet !== 'undefined' ? networks.bitcoin : ( typeof network.testnet !== 'undefined' ? networks.testnet  : networks.regtest ));
}

export async function getCanisterAddress()
{
    if(CANISTER_BITCOIN_ADDRESS !== '')
    {
        return CANISTER_BITCOIN_ADDRESS;
    }

    // Retrieve the public key of this canister at the given derivation path
    // from the ECDSA API.
    const response = await fetch('icp://aaaaa-aa/ecdsa_public_key', {
        body: serialize({
            args: [
                {
                    canister_id: [],
                    derivation_path: [],
                    key_id: {
                        curve: { secp256k1: null },
                        name: key_id // main: key_1, testnet: test_key_1, regtest: dfx_test_key
                    }
                }
            ],
            cycles: SIGN_WITH_ECDSA_COST_CYCLES
        })
    });
    const res = await response.json();

    CANISTER_BITCOIN_ADDRESS = publicKeyToP2wpkhAddress(res.public_key);
    return CANISTER_BITCOIN_ADDRESS;
}

export async function signWithECDSA(
    keyName: string,
    derivationPath: Uint8Array[],
    messageHash: Uint8Array
): Promise<Uint8Array> {
    const publicKeyResponse = await fetch(`icp://aaaaa-aa/sign_with_ecdsa`, {
        body: serialize({
            args: [
                {
                    message_hash: messageHash,
                    derivation_path: derivationPath,
                    key_id: {
                        curve: { secp256k1: null },
                        name: keyName
                    }
                }
            ],
            cycles: SIGN_WITH_ECDSA_COST_CYCLES
        })
    });
    const res = await publicKeyResponse.json();

    return res.signature;
}

export async function signHashWithECDSARaw(messageHash)
{
    const publicKeyResponse = await fetch(`icp://aaaaa-aa/sign_with_ecdsa`, {
        body: serialize({
            args: [
                {
                    message_hash: messageHash,
                    derivation_path: [],
                    key_id: {
                        curve: { secp256k1: null },
                        name: key_id // main: key_1, main/test: test_key_1, regtest: dfx_test_key
                    }
                }
            ],
            cycles: SIGN_WITH_ECDSA_COST_CYCLES
        })
    });
    const res = await publicKeyResponse.json();

    return res.signature;
}

export async function signHashWithECDSA(messageHash)
{
    let hash = sha256.create();
    hash.update(messageHash);
    const publicKeyResponse = await fetch(`icp://aaaaa-aa/sign_with_ecdsa`, {
        body: serialize({
            args: [
                {
                    message_hash: hash.array(),
                    derivation_path: [],
                    key_id: {
                        curve: { secp256k1: null },
                        name: key_id // main: key_1, main/test: test_key_1, regtest: dfx_test_key
                    }
                }
            ],
            cycles: SIGN_WITH_ECDSA_COST_CYCLES
        })
    });
    const res = await publicKeyResponse.json();

    return Buffer.from(res.signature).toString('hex');
}

export async function getBalance (address)
{
    const response = await fetch(`icp://aaaaa-aa/bitcoin_get_balance`, {
        body: serialize({
            args: [
                {
                    address,
                    min_confirmations: [3],
                    network
                }
            ],
            cycles: BITCOIN_GETBALANCE_COST
        })
    });
    const responseJson = await response.json();

    return responseJson;
}

export async function getCurrentFeePercentiles()
{
    const response = await fetch(
        `icp://aaaaa-aa/bitcoin_get_current_fee_percentiles`,
        {
            body: serialize({
                args: [
                    {
                        network
                    }
                ],
                cycles: BITCOIN_GETPERCENTILES_COST
            })
        }
    );
    const responseJson = await response.json();

    return responseJson;
}

export async function getUtxos (address, next_page = null, cnt = 0)
{

    let args = {
        address,
        network,
        filter: [] // TODO: set to 3 {min_confirmations : 3}
    };

    let args_next_page = {
        address,
        network,
        filter: [{page : next_page}] // TODO: set to 3 {min_confirmations : 3}
    };

    const response = await fetch(`icp://aaaaa-aa/bitcoin_get_utxos`, {
        body: serialize({
            args: [ next_page !== null ? args_next_page : args ],
            cycles: BITCOIN_GETUTXOS_COST
        })
    });

    let responseJson = await response.json();

    // processing the 2nd page if any.
    if(responseJson.next_page !== null && responseJson.next_page.length !== 0 && cnt === 0)
    {
        // TODO: figure what data type next_page actually is. The utxo endpoint returns null but applying json returns an empty array if there is no next page.
        //       for now, we are trying to pass the same to the call for next page that we retrieved. most likely won't work.
        try {
            const next_response = await getUtxos(address, responseJson.next_page, cnt + 1);
            const next_response_json = await next_response.json();
            responseJson = [...responseJson, ...next_response_json]
        }
        catch(e)
        {
            console.log('debug', e.message);
        }
    }

    return responseJson;
}

export async function getCanisterPubkey()
{
    if(CANISTER_BITCOIN_PUBKEY !== '')
    {
        return CANISTER_BITCOIN_PUBKEY;
    }

    // Retrieve the public key of this canister at the given derivation path
    // from the ECDSA API.
    const response = await fetch('icp://aaaaa-aa/ecdsa_public_key', {
        body: serialize({
            args: [
                {
                    canister_id: [],
                    derivation_path: [],
                    key_id: {
                        curve: { secp256k1: null },
                        name: key_id // main: key_1, testnet: test_key_1, regtest: dfx_test_key
                    }
                }
            ],
            cycles: SIGN_WITH_ECDSA_COST_CYCLES
        })
    });
    const res = await response.json();

    CANISTER_BITCOIN_PUBKEY = Buffer.from(res.public_key).toString('hex');
    return CANISTER_BITCOIN_PUBKEY;
}

export async function sendTransaction(
    transaction: Uint8Array
): Promise<void> {
    const transactionFee =
        SEND_TRANSACTION_BASE_CYCLES +
        BigInt(transaction.length) * SEND_TRANSACTION_PER_BYTE_CYCLES;

    await fetch(`icp://aaaaa-aa/bitcoin_send_transaction`, {
        body: serialize({
            args: [
                {
                    transaction,
                    network
                }
            ],
            cycles: transactionFee
        })
    });
}

export function deleteUtxo(tx, vout)
{
    const updated = 'curr_utxos_index_' + tx + ':' + vout;

    if (stable_storage.dbContainsKey(updated) && stable_storage.dbContainsKey('curr_utxos'))
    {
        let curr_value = stable_storage.dbGet('curr_utxos_value');
        const curr_utxos = stable_storage.dbGet('curr_utxos');
        const curr_utxos_index = stable_storage.dbGet(updated);
        const removed = curr_utxos.splice(curr_utxos_index, 1);
        console.log('REMOVED', removed);
        curr_value -= removed[0].value;
        if(curr_value < 0)
        {
            curr_value = 0;
        }
        stable_storage.dbPut('curr_utxos_value', curr_value);
        stable_storage.dbPut('curr_utxos', curr_utxos);
        stable_storage.dbDel(updated);
        return curr_utxos;
    }
    return [];
}

export function storeUtxo(entry)
{
    if (!stable_storage.dbContainsKey('curr_utxos'))
    {
        stable_storage.dbPut('curr_utxos', []);
    }

    if (!stable_storage.dbContainsKey('curr_utxos_value'))
    {
        stable_storage.dbPut('curr_utxos_value', 0);
    }

    let curr_value = stable_storage.dbGet('curr_utxos_value');
    if(isNaN(curr_value))
    {
        curr_value = 0;
    }
    let ordered_utxos = stable_storage.dbGet('curr_utxos');
    ordered_utxos.push(
        {
            value : Number(entry.val),
            tx : entry.tx,
            vo : Number(entry.vo),
            outpoint : {
                txid : Uint8Array.from(Buffer.from(entry.tx, 'hex')),
                vout : Number(entry.vo)
            }
        });
    ordered_utxos.sort((a,b) => a.value - b.value);
    ordered_utxos = ordered_utxos.reverse();
    const amount_to_pop = 200 - ordered_utxos.length;
    if(amount_to_pop < 0)
    {
        ordered_utxos.splice(-1, amount_to_pop * -1);
    }
    for(let i = 0; i < ordered_utxos.length; i++)
    {
        stable_storage.dbPut('curr_utxos_index_'+ordered_utxos[i].tx+':'+ordered_utxos[i].vo, i);
    }
    curr_value += Number(entry.val);

    console.log("NEW UTXO VALUE", curr_value);
    console.log("NEW UTXO SET", ordered_utxos);

    stable_storage.dbPut('curr_utxos_value', curr_value);
    stable_storage.dbPut('curr_utxos', ordered_utxos);
}

export function isValidBitcoinAddress(toAddress) {

    if(toAddress.startsWith('bc1q'))
    {
        try {
            Address.p2wpkh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('tb1q') || toAddress.startsWith('bcrt1q'))
    {
        try {
            Address.p2wpkh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('1'))
    {
        try {
            Address.p2pkh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('m') || toAddress.startsWith('n'))
    {
        try {
            Address.p2pkh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('3'))
    {
        try {
            Address.p2sh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('2'))
    {
        try {
            Address.p2sh.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else if(toAddress.startsWith('tb1p') || toAddress.startsWith('bcrt1p'))
    {
        try {
            Address.p2tr.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }
    else
    {
        try {
            Address.p2tr.decode(toAddress, TAPSCRIPT_NETWORK).hex;
            return true;
        } catch (e) {
            console.log(e, toAddress);
        }
    }

    return false;
}