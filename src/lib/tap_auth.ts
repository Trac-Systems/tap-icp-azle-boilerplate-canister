import {sha256} from "js-sha256";
import * as eth_util from "ethereumjs-util";
import * as secp from "@noble/secp256k1";
import * as bitcoin_api from "./bitcoin_api";
import {TOKEN_AUTH_INSCRIPTION, ETH_CHAIN_ID, PRIVILEGE_AUTH_INSCRIPTION} from "../config";
import {Address, encodeAbiParameters, encodePacked, keccak256} from "viem";
import { Address,
    keccak256,
    toBytes,
    isAddressEqual,
    recoverAddress,
    serializeSignature,
    toHex
} from 'viem'
import {CANISTER_ETHEREUM_ADDRESS} from "./eth_api";

export async function signCreateVoucher(item)
{
    const hash = keccak256(
        encodePacked(
            ['bytes'],
            [encodeAbiParameters([
                { name: 'account', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'token', type: 'string' },
                { name: 'decimals', type: 'uint8' },
                { name: 'nonce', type: 'uint256' },
                { name: 'chain_id', type: 'uint256' }
            ], [item.ethAddress as Address, item.amt, item.tick, item.dec, item.nonce, ETH_CHAIN_ID])]
        )
    )

    const partialSignature = await bitcoin_api.signHashWithECDSARaw(toBytes(hash));
    if (partialSignature.length != 64) throw new Error('invalid signature')
    const r = toHex(partialSignature.slice(0, 32))
    const s = toHex(partialSignature.slice(32, 64))

    const possibleVs = [27n, 28n, 29n, 30n];

    for (const v of possibleVs) {
        const signature = serializeSignature({ r, s, v })
        const recovered = await recoverAddress({ hash, signature })
        if (isAddressEqual(recovered, CANISTER_ETHEREUM_ADDRESS as Address)) {
            return serializeSignature({ r, s, v }).toString();
        }
    }

    throw Error('Self sign for voucher failed. This may never happen and indicates a bug within the canister.');
}

export async function tap(txid, vout, value)
{
    const pubkey = Buffer.from(bitcoin_api.CANISTER_BITCOIN_PUBKEY, 'hex');
    const address = bitcoin_api.CANISTER_BITCOIN_ADDRESS;

    let utxos = await bitcoin_api.getUtxos(address);
    utxos = utxos.utxos;

    const feePercentiles = await bitcoin_api.getCurrentFeePercentiles();

    const feePerByte = bitcoin_api.key_id !== 'key_1' && bitcoin_api.key_id !== 'test_key_1'
        ? // There are no fee percentiles. This case can only happen on a regtest
          // network where there are no non-coinbase transactions. In this case,
          // we use a default of 2000 millisatoshis/byte (i.e. 2 satoshi/byte)
        2_000n
        : // Choose the 50th percentile for sending fees.
        bitcoin_api.key_id === 'test_key_1' ? feePercentiles[50] : feePercentiles[75];

    console.log(pubkey,
        address,
        utxos,
        address,
        1000n,
        feePerByte,
        {
            txid : txid.trim(),
            vout,
            value
        });

    const transaction = await bitcoin_api.buildTransaction(
        pubkey,
        address,
        utxos,
        address,
        1000n,
        feePerByte,
        {
            txid : txid.trim(),
            vout,
            value
        }
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

    console.info('Sending transaction...');
    await bitcoin_api.sendTransaction(signedTransactionBytes);
    console.info('Done');

    return signedTransaction.toHex();
}

export async function signCreateTokenRedemption(items)
{
    const public_key = await bitcoin_api.getCanisterPubkey();

    // actual hash creation

    let recovery = 0;
    const salt = Math.random();
    const redeem = {
        items : items,
        auth : TOKEN_AUTH_INSCRIPTION,
        data : ''
    };

    let proto = {
        p : 'tap',
        op : 'token-auth',
        redeem : redeem,
        sig: {},
        hash : '',
        salt : ''+salt
    }

    const raw_hash = JSON.stringify(redeem) + salt;

    let hash = sha256.create();
    hash.update(raw_hash);
    proto.hash = hash.hex();

    const hex_signature = await bitcoin_api.signHashWithECDSA(raw_hash);

    console.log('HEX SIG', hex_signature);

    let success = false;

    // low-tech way to determine the correct recovery bit (0,1)
    // TODO: instead of duplicating the code, create a re-usable function
    try
    {
        const res = eth_util.fromRpcSig('0x'+hex_signature);
        const r = BigInt('0x'+Buffer.from(res.r).toString('hex'));
        const s =  BigInt('0x'+Buffer.from(res.s).toString('hex'));

        try
        {
            let test = new secp.Signature(r, s, recovery);
            let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
            if(recovered_pk === public_key)
            {
                success = true;
                proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
            }
        }
        catch(e) {}

        if(false === success)
        {
            try
            {
                recovery = 1;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 2;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 3;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }
    }
    catch(e) {}

    if(false === success)
    {
        return 'ERR_TAP_AUTHORITY';
    }

    return JSON.stringify(proto);
}

export async function signCreateTokenAuthority()
{
    const public_key = await bitcoin_api.getCanisterPubkey();

    // actual hash creation

    let recovery = 0;
    const auth = [];
    const salt = Math.random();

    let proto = {
        p : 'tap',
        op : 'token-auth',
        auth : auth,
        sig: {},
        hash : '',
        salt : ''+salt
    }

    const raw_hash = JSON.stringify(auth) + salt;

    let hash = sha256.create();
    hash.update(raw_hash);
    proto.hash = hash.hex();

    const hex_signature = await bitcoin_api.signHashWithECDSA(raw_hash);

    console.log('HEX SIG', hex_signature);

    let success = false;

    // low-tech way to determine the correct recovery bit (0,1)
    // TODO: instead of duplicating the code, create a re-usable function
    try
    {
        const res = eth_util.fromRpcSig('0x'+hex_signature);
        const r = BigInt('0x'+Buffer.from(res.r).toString('hex'));
        const s =  BigInt('0x'+Buffer.from(res.s).toString('hex'));

        try
        {
            let test = new secp.Signature(r, s, recovery);
            let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
            if(recovered_pk === public_key)
            {
                success = true;
                proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
            }
        }
        catch(e) {}

        if(false === success)
        {
            try
            {
                recovery = 1;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 2;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 3;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }
    }
    catch(e) {}

    if(false === success)
    {
        return 'ERR_TAP_AUTHORITY';
    }

    return JSON.stringify(proto);
}

export async function signCreatePrivilegeAuthorityVerified(sha256_hash, collection, sequence, address)
{
    const public_key = await bitcoin_api.getCanisterPubkey();

    // actual hash creation

    let recovery = 0;
    const salt = Math.random();

    let proto = {
        p : 'tap',
        op : 'privilege-auth',
        sig : {},
        hash : '',
        address : address,
        salt : ''+salt,
        prv : PRIVILEGE_AUTH_INSCRIPTION,
        verify : sha256_hash,
        col : collection,
        seq : sequence
    }

    const raw_hash = proto.prv + '-' + proto.col + '-' + proto.verify + '-'  + proto.seq + '-' + proto.address + '-' + proto.salt;

    let hash = sha256.create();
    hash.update(raw_hash);
    proto.hash = hash.hex();

    const hex_signature = await bitcoin_api.signHashWithECDSA(raw_hash);

    console.log('HEX SIG', hex_signature);

    let success = false;

    // low-tech way to determine the correct recovery bit (0,1)
    // TODO: instead of duplicating the code, create a re-usable function
    try
    {
        const res = eth_util.fromRpcSig('0x'+hex_signature);
        const r = BigInt('0x'+Buffer.from(res.r).toString('hex'));
        const s =  BigInt('0x'+Buffer.from(res.s).toString('hex'));

        try
        {
            let test = new secp.Signature(r, s, recovery);
            let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
            if(recovered_pk === public_key)
            {
                success = true;
                proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
            }
        }
        catch(e) {}

        if(false === success)
        {
            try
            {
                recovery = 1;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 2;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 3;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }
    }
    catch(e) {}

    if(false === success)
    {
        return 'ERR_TAP_AUTHORITY';
    }

    return JSON.stringify(proto);
}

export async function signCreatePrivilegeAuthority()
{
    const public_key = await bitcoin_api.getCanisterPubkey();

    // actual hash creation

    let recovery = 0;
    const auth = {
        'name' : 'Tapswap Privilege Authority'
    };
    const salt = Math.random();

    let proto = {
        p : 'tap',
        op : 'privilege-auth',
        sig: {},
        hash : '',
        salt : ''+salt,
        auth : auth
    }

    const raw_hash = JSON.stringify(auth) + salt;

    let hash = sha256.create();
    hash.update(raw_hash);
    proto.hash = hash.hex();

    const hex_signature = await bitcoin_api.signHashWithECDSA(raw_hash);

    console.log('HEX SIG', hex_signature);

    let success = false;

    // low-tech way to determine the correct recovery bit (0,1)
    // TODO: instead of duplicating the code, create a re-usable function
    try
    {
        const res = eth_util.fromRpcSig('0x'+hex_signature);
        const r = BigInt('0x'+Buffer.from(res.r).toString('hex'));
        const s =  BigInt('0x'+Buffer.from(res.s).toString('hex'));

        try
        {
            let test = new secp.Signature(r, s, recovery);
            let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
            if(recovered_pk === public_key)
            {
                success = true;
                proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
            }
        }
        catch(e) {}

        if(false === success)
        {
            try
            {
                recovery = 1;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 2;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }

        if(false === success)
        {
            try
            {
                recovery = 3;
                let test = new secp.Signature(r, s, recovery);
                let recovered_pk = test.recoverPublicKey(hash.toString()).toHex();
                if(recovered_pk === public_key)
                {
                    success = true;
                    proto.sig = { v : '' + recovery, r : test.r.toString(), s : test.s.toString()};
                }
            }
            catch(e) {}
        }
    }
    catch(e) {}

    if(false === success)
    {
        return 'ERR_TAP_AUTHORITY';
    }

    return JSON.stringify(proto);
}