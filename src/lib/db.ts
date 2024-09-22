import {IDL, StableBTreeMap} from "azle";
import * as tap_api from "./tap_api";

const Key = IDL.Text;
type Key = typeof Key.tsType;

const Value = IDL.Text;
type Value = typeof Value.tsType;

let map = StableBTreeMap<Key, Value>(0);

export function dbGet(key)
{
    return map.get(key);
}

export function dbPut(key, value)
{
    return map.insert(key, value);
}

export function dbDel(key)
{
    return map.remove(key);
}

export function dbContainsKey(key) : boolean
{
    return map.containsKey(key);
}

export function apiErrorMsg(object)
{
    return typeof object !== 'undefined' && object.err !== 'undefined' ? object.err : 'No data';
}
export async function addRefundLog(value)
{
    if (typeof value.utxo === 'undefined' || true === dbContainsKey(value.utxo) || value.addr === null)
    {
        return null;
    }

    if(typeof value.dec !== 'undefined' && value.dec === null)
    {
        const deployed_ticker = 'd_' + JSON.stringify(value.tick);

        if(false === dbContainsKey(deployed_ticker))
        {
            const deployed_full = await tap_api.deployment(value.tick);

            if(typeof deployed_full.err !== 'undefined' || deployed_full === null)
            {
                throw new Error(tap_api.apiErrorMsg(deployed_full));
            }

            dbPut(deployed_ticker, {'dec':deployed_full.dec});
        }

        let deployed = dbGet(deployed_ticker);
        value.dec = deployed.dec;
    }

    const ref = await addLog(value);

    if(ref !== null)
    {
        await addRef(value.utxo,ref);
    }

    // marking this utxo as processed, simply because addRefundLog is supposed to be used to abort transaction activity
    dbPut(value.utxo, '');

    return ref;
}


export async function addLog(value)
{
    let log_length = 0;

    if (false === dbContainsKey('log_n'))
    {
        dbPut('log_n', 0);
    }

    log_length = dbGet('log_n');

    if (false === dbContainsKey('log_' + log_length))
    {
        dbPut('log_' + log_length, value);
        dbPut('log_n', log_length + 1);

        return 'log_' + log_length;
    }

    return null;
}

export async function addRef(key, ref)
{
    if (false === dbContainsKey('ref_' + key)) {
        dbPut('ref_' + key, ref);
    }
}
