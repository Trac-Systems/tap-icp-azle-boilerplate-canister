import {id, call, IDL, Principal} from "azle";
import {HttpRequestArgs, HttpResponse} from 'azle/canisters/management';
import {API_HOST, MINT_TICK} from "../config";

// compat reasons, not required for this canister
export const PRIVILEGE_AUTH_INSCRIPTION = '';

export function apiErrorMsg(object)
{
    return typeof object !== 'undefined' && typeof object.err !== 'undefined' ? object.err : 'No data';
}

export async function deployment(ticker)
{
    return await apiCall(`getDeployment/${ticker}`);
}

export async function updatedBlock()
{
    return await apiCall('getCurrentBlock');
}

export async function tapSwapMintLength(block)
{
    return await apiCall(`getTickerMintedListByBlockLength/${MINT_TICK}/${block}`);
}

export async function tapSwapMints(block, length)
{
    let max = 100n;
    const max_response_bytes_each = 1300n;
    let mints = [];

    // simplest way of saving some cycles in case nothing to page through
    if(length < max)
    {
        max = length;
    }

    const pages = Math.ceil(Number(length) / Number(max));

    for(let i = 0n; i < pages; i++)
    {
        let offset = i * max;
        const res = await apiCall(`getTickerMintedListByBlock/${MINT_TICK}/${block}?offset=${offset.toString()}&max=${max.toString()}`, max_response_bytes_each * max);
        if(typeof res.err !== 'undefined')
        {
            return res;
        }
        mints = [...mints, ...res]
    }

    return mints;
}

export async function tapTransfersLength(block)
{
    return await apiCall(`getTransferredListByBlockLength/${block}`);
}

export async function tapTransfers(block, length)
{
    let max = 100n;
    const max_response_bytes_each = 1300n;
    let transfers = [];

    // simplest way of saving some cycles in case nothing to page through
    if(length < max)
    {
        max = length;
    }

    const pages = Math.ceil(Number(length) / Number(max));

    for(let i = 0n; i < pages; i++)
    {
        let offset = i * max;
        const res = await apiCall(`getTransferredListByBlock/${block}?offset=${offset.toString()}&max=${max.toString()}`, max_response_bytes_each * max);
        if(typeof res.err !== 'undefined')
        {
            return res;
        }
        transfers = [...transfers, ...res];
    }

    return transfers;
}

export async function tapTokenTransfersLength(ticker, block)
{
    return await apiCall(`getTickerTransferredListByBlockLength/${ticker}/${block}`);
}

export async function tapTokenTransfers(ticker, block, length)
{
    let max = 100n;
    const max_response_bytes_each = 1300n;
    let transfers = [];

    // simplest way of saving some cycles in case nothing to page through
    if(length < max)
    {
        max = length;
    }

    const pages = Math.ceil(Number(length) / Number(max));

    for(let i = 0n; i < pages; i++)
    {
        let offset = i * max;
        const res = await apiCall(`getTickerTransferredListByBlock/${ticker}/${block}?offset=${offset.toString()}&max=${max.toString()}`, max_response_bytes_each * max);
        if(typeof res.err !== 'undefined')
        {
            return res;
        }
        transfers = [...transfers, ...res];
    }

    return transfers;
}

export async function tapPrivStakingVerifiedLength(block)
{
    return await apiCall(`getPrivilegeAuthorityEventByPrivColBlockLength/${PRIVILEGE_AUTH_INSCRIPTION}/Staking/${block}`);
}

export async function tapPrivStakingVerified(block, length)
{
    let max = 100n;
    const max_response_bytes_each = 1300n;
    let transfers = [];

    // simplest way of saving some cycles in case nothing to page through
    if(length < max)
    {
        max = length;
    }

    const pages = Math.ceil(Number(length) / Number(max));

    for(let i = 0n; i < pages; i++)
    {
        let offset = i * max;
        const res = await apiCall(`getPrivilegeAuthorityEventByPrivColBlock/${PRIVILEGE_AUTH_INSCRIPTION}/Staking/${block}?offset=${offset.toString()}&max=${max.toString()}`, max_response_bytes_each * max);
        if(typeof res.err !== 'undefined')
        {
            return res;
        }
        transfers = [...transfers, ...res];
    }

    return transfers;
}

export async function tapPrivVerifiedLength(block)
{
    return await apiCall(`getPrivilegeAuthorityEventByPrivColBlockLength/${PRIVILEGE_AUTH_INSCRIPTION}/Liquidity/${block}`);
}

export async function tapPrivVerified(block, length)
{
    let max = 100n;
    const max_response_bytes_each = 1300n;
    let transfers = [];

    // simplest way of saving some cycles in case nothing to page through
    if(length < max)
    {
        max = length;
    }

    const pages = Math.ceil(Number(length) / Number(max));

    for(let i = 0n; i < pages; i++)
    {
        let offset = i * max;
        const res = await apiCall(`getPrivilegeAuthorityEventByPrivColBlock/${PRIVILEGE_AUTH_INSCRIPTION}/Liquidity/${block}?offset=${offset.toString()}&max=${max.toString()}`, max_response_bytes_each * max);
        if(typeof res.err !== 'undefined')
        {
            return res;
        }
        transfers = [...transfers, ...res];
    }

    return transfers;
}

export async function apiCall(endpoint, max_response_bytes = 1_024n, method = { get : null })
{
    try {

        /**
         * Cost calculation based on https://internetcomputer.org/docs/current/developer-docs/gas-cost
         */
        const nodes = 13n;
        const cycles = ( ( 3_000_000n + 60_000n * nodes ) * nodes ) + ( 400n * nodes * max_response_bytes ) + ( 800n * nodes * max_response_bytes );

        const response = await call('aaaaa-aa', 'http_request', {
            paramIdlTypes: [HttpRequestArgs],
            returnIdlType: HttpResponse,
            args: [
                {
                    url: `https://${API_HOST}/${endpoint}`,
                    max_response_bytes: [max_response_bytes],
                    method: {
                        get: null
                    },
                    headers: [],
                    body: [],
                    transform: [
                        {
                            function: [id(), 'xkcdTransform'] as [
                                Principal,
                                string
                            ],
                            context: Uint8Array.from([])
                        }
                    ]
                }
            ],
            payment: cycles
        });

        const result = JSON.parse(Buffer.from(response.body).toString());
        return result.result;
    }
    catch(e)
    {
        console.log('API ERROR', e);
        return { err : e.message };
    }
}