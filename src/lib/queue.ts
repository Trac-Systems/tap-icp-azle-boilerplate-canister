import * as tools from "./tools";
import {signCreatePrivilegeAuthorityVerified, signCreateTokenRedemption} from "./tap_auth";
import * as bitcoin_api from "./bitcoin_api";

export async function process(log_entry : object, ref : string, utxos : any)
{
    if(typeof log_entry.type !== 'string' || typeof log_entry.proc === 'undefined' || true === log_entry.proc)
    {
        return null;
    }

    // here we process the mintMessage from lib/incoming.ts
    // please note that we prepare a signature for a redeem as well as a bitcoin transaction
    if(log_entry.type === 'mintMessage')
    {
        return queueable({
            tick: log_entry.tick,
            amt : log_entry.amt,
            dec : log_entry.dec,
            addr : log_entry.addr,
            ref : ref
        }, {
            addr : log_entry.addr,
            sats : BigInt(log_entry.sats),
            fee : BigInt(log_entry.fee),
            utxos : utxos,
            ref : ref
        });
    }
    // a general btc refund type that only addresses transactions
    else if(log_entry.type === 'btcRefund')
    {
        return queueable(null, {
            addr : log_entry.addr,
            sats : BigInt(log_entry.sats),
            fee : BigInt(log_entry.fee),
            utxos : utxos,
            ref : ref
        });
    }

    return null;
}

export async function isLogEntryTransactable(log_entry : object)
{
    if(typeof log_entry.addr === 'undefined' ||
        typeof log_entry.sats === 'undefined' ||
        typeof log_entry.fee === 'undefined' ||
        typeof log_entry.type !== 'string' ||
        typeof log_entry.proc === 'undefined' ||
        true === log_entry.proc
    )
    {
        return false;
    }

    // messages as of lib/incoming.ts
    if(log_entry.type === 'mintMessage' || log_entry.type === 'btcRefund')
    {
        return true;
    }

    return false;
}

async function queueable(redemption = null, transaction = null, privilege_verified = null)
{
    let ref = null;
    let redeem = null;
    let priv_verified = null;
    let tx = null;
    let signResult = null;

    if(transaction !== null && typeof transaction.sats !== 'undefined' && typeof transaction.fee !== 'undefined' && transaction.sats >= 546 && transaction.fee >= 546)
    {
        ref = transaction.ref;

        signResult = await prepareTransaction(transaction.addr, transaction.sats, transaction.fee, transaction.utxos);
    }

    if(redemption !== null)
    {
        ref = redemption.ref;

        redeem = await signCreateTokenRedemption([
            {
                "tick": redemption.tick,
                "amt": tools.formatNumberString(redemption.amt, redemption.dec),
                "address": redemption.addr
            }
        ]);

        if(redeem === 'ERR_TAP_AUTHORITY')
        {
            throw new Error('Redemption failed');
        }
    }

    if(privilege_verified !== null)
    {
        ref = privilege_verified.ref;

        priv_verified = await signCreatePrivilegeAuthorityVerified(
            privilege_verified.s256h,
            privilege_verified.col,
            privilege_verified.seq,
            privilege_verified.addr
        );

        if(priv_verified === 'ERR_TAP_AUTHORITY')
        {
            throw new Error('Privilege verification failed');
        }
    }

    if(signResult !== null)
    {
        console.info('Sending transaction...');
        await bitcoin_api.sendTransaction(signResult.signedTransactionBytes);
        console.info('Sending transaction done');
        tx = signResult.signedTransaction.toHex();
    }

    return { redeem, privilege_verified : priv_verified, tx, ref : ref };
}

export async function prepareTransaction(addr : string, sats : bigint, fee : bigint, utxos : any)
{
    const pubkey = Buffer.from(bitcoin_api.CANISTER_BITCOIN_PUBKEY, 'hex');
    const address = bitcoin_api.CANISTER_BITCOIN_ADDRESS;

    const transaction = await bitcoin_api.buildTransactionWithFee(
        utxos,
        address,
        addr,
        sats,
        fee,
        {},
        true
    );

    const signedTransaction = await bitcoin_api.signTransaction(
        pubkey,
        transaction,
        bitcoin_api.key_id, // main: key_1, testnet: test_key_1, regtest: dfx_test_key
        [],
        bitcoin_api.signWithECDSA,
        bitcoin_api.validator

    );

    const signedTransactionBytes = signedTransaction.toBuffer();

    console.info(
        `Signed transaction: ${signedTransactionBytes.toString('hex')}`
    );

    return {signedTransactionBytes, signedTransaction, transaction};
}