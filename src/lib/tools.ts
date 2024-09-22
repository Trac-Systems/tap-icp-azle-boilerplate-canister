export function biSqrt(value) {
    if (value < 0n) {
        throw 'square root of negative numbers is not supported'
    }

    if (value < 2n) {
        return value;
    }

    function newtonIteration(n, x0) {
        const x1 = ((n / x0) + x0) >> 1n;
        if (x0 === x1 || x0 === (x1 - 1n)) {
            return x0;
        }
        return newtonIteration(n, x1);
    }

    return newtonIteration(value, 1n);
}


export function formatNumberString(string, decimals) {

    let pos = string.length - decimals;

    if(decimals == 0) {
        // nothing
    }else
    if(pos > 0){
        string = string.substring(0, pos) + "." + string.substring(pos, string.length);
    }else{
        string = '0.' + ( "0".repeat( decimals - string.length ) ) + string;
    }

    return string;
}

export function resolveNumberString(number, decimals){

    let splitted = number.split(".");
    if(splitted.length == 1 && decimals > 0){
        splitted[1] = '';
    }
    if(splitted.length > 1) {
        let size = decimals - splitted[1].length;
        for (let i = 0; i < size; i++) {
            splitted[1] += "0";
        }
        let new_splitted = '';
        for(let i = 0; i < splitted[1].length; i++)
        {
            if(i >= decimals)
            {
                break;
            }
            new_splitted += splitted[1][i];
        }
        number = "" + (splitted[0] == '0' ? '' : splitted[0]) + new_splitted;
        if(BigInt(number) == 0n || number === ''){
            number = "0";
        }
    }

    try {

        while (number.charAt(0) === '0') {
            number = number.substring(1);
        }

    }catch(e){

        number = '0';
    }

    return number === '' ? '0' : number;
}

export function satsDiff(dec : number): bigint
{
    if(8 > dec)
    {
        return 8n - BigInt(dec);
    }
    else if(8 < dec)
    {
        return BigInt(dec) - 8n;
    }

    return BigInt(dec);
}

export function normalizeValue(value : bigint, decimals_a : number, decimals_b : number) : bigint
{
    if(decimals_a > decimals_b)
    {
        value = value / (10n ** (BigInt(decimals_a) - BigInt(decimals_b)));
    }
    else if(decimals_a < decimals_b)
    {
        value = value * (10n ** (BigInt(decimals_b) - BigInt(decimals_a)));
    }

    return value;
}

export async function calcRatio(new_val : bigint, old_val : bigint, decimals : number)
{
    if(old_val === 0n)
    {
        return 0n;
    }

    return ( new_val * 10n**26n ) / ( old_val  * 10n**( 26n-BigInt(decimals) ) );
}

export async function calcIncrease(new_val : bigint, old_val : bigint, decimals : number)
{
    if(old_val === 0n)
    {
        return 0n;
    }

    return ( ( new_val - old_val ) * 10n**26n ) / ( old_val  * 10n**( 26n-BigInt(decimals) ) );
}

export async function calcDecrease(new_val : bigint, old_val : bigint, decimals : number)
{
    if(old_val === 0n)
    {
        return 0n;
    }

    return ( ( old_val - new_val ) * 10n**26n ) / ( old_val  * 10n**( 26n-BigInt(decimals) ) );
}

export async function calcPrice(value_a : bigint, value_b : bigint, decimals : number)
{
    if(value_b === 0n)
    {
        return 0n;
    }
    return ( value_a * 10n**BigInt(decimals) ) / value_b;
}