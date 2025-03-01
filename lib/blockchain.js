import axios from 'axios';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();

/**
 * Determine blockchain type based on address format
 * @param {string} address - Wallet address
 * @returns {string|null} Blockchain type (bitcoin, ethereum) or null if unknown
 */
export function determineBlockchain(address) {
  address = address.toLowerCase();
  if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) {
    return 'bitcoin';
  } else if (address.startsWith('0x')) {
    return 'ethereum';
  }
  return null;
}

/**
 * Get current block number for specified blockchain
 * @param {string} blockchain - Blockchain type (bitcoin, ethereum)
 * @returns {Promise<number|null>} Current block number or null if error
 */
export async function getCurrentBlock(blockchain) {
  try {
    if (blockchain === 'bitcoin') {
      const response = await axios.get(`${serverRuntimeConfig.GETBLOCK_BTC_URL}/blocks/tip/height`);
      return parseInt(response.data);
    } else if (blockchain === 'ethereum') {
      const url = serverRuntimeConfig.GETBLOCK_ETH_URL;
      const payload = { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 };
      const response = await axios.post(url, payload);
      return parseInt(response.data.result, 16);
    }
    return null;
  } catch (error) {
    console.error(`Error getting current block for ${blockchain}:`, error);
    return null;
  }
}

/**
 * Determine destination label for an address using Moralis API
 * @param {string} toAddress - Destination address
 * @returns {Promise<string>} Label or "Unknown" if not identified
 */
export async function determineDestination(toAddress) {
  try {
    const url = `https://deep-index.moralis.io/api/v2/wallet/${toAddress}/labels`;
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': serverRuntimeConfig.MORALIS_API_KEY
      }
    });

    if (response.status === 200 && response.data.labels && response.data.labels.length > 0) {
      return response.data.labels[0].name;
    }
    return 'Unknown';
  } catch (error) {
    console.error('Error determining destination:', error);
    return 'Unknown';
  }
}

/**
 * Fetch suspicious addresses from external source
 * @returns {Promise<string[]>} Array of suspicious addresses
 */
export async function fetchSuspiciousAddresses() {
  try {
    const url = 'https://hackscan.hackbounty.io/public/hack-address.json';
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching suspicious addresses:', error);
    return [];
  }
}