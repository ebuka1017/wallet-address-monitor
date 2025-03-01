import axios from 'axios';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();

/**
 * Fetch Bitcoin transactions for a specified address
 * @param {string} address - Bitcoin address to monitor
 * @param {number} lastBlock - Last block that was checked
 * @returns {Promise<Array>} Array of outgoing transactions
 */
export async function fetchBitcoinTransactions(address, lastBlock) {
  try {
    const response = await axios.get(`${serverRuntimeConfig.GETBLOCK_BTC_URL}/address/${address}`);
    const txs = response.data?.txids?.slice(0, 10) || [];
    const outgoing = [];

    for (const txHash of txs) {
      const txResponse = await axios.get(`${serverRuntimeConfig.GETBLOCK_BTC_URL}/tx/${txHash}`);
      const txData = txResponse.data;
      const blockHeight = txData.block_height || 0;
      
      if (blockHeight <= lastBlock) {
        continue;
      }
      
      // Check if this is an outgoing transaction (address is in inputs)
      const isOutgoing = txData.vin?.some(vin => 
        vin.prevout?.scriptpubkey_address === address
      );
      
      if (isOutgoing) {
        outgoing.push({
          hash: txHash,
          block_height: blockHeight,
          outputs: txData.vout || []
        });
      }
    }
    
    return outgoing;
  } catch (error) {
    console.error('Error fetching Bitcoin transactions:', error);
    return [];
  }
}

/**
 * Fetch Ethereum transactions for a specified address
 * @param {string} address - Ethereum address to monitor
 * @param {number} startBlock - Block to start checking from
 * @returns {Promise<Array>} Array of outgoing transactions
 */
export async function fetchEthereumTransactions(address, startBlock) {
  try {
    const url = serverRuntimeConfig.GETBLOCK_ETH_URL;
    
    // Get logs for the address
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock: '0x' + startBlock.toString(16),
        toBlock: 'latest',
        address: address
      }],
      id: 1
    };
    
    const response = await axios.post(url, payload);
    const logs = response.data?.result || [];
    const outgoing = [];
    
    for (const log of logs) {
      const txHash = log.transactionHash;
      
      // Get transaction details
      const txResponse = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 2
      });
      
      const txData = txResponse.data?.result || {};
      
      // Check if this is an outgoing transaction
      if (txData.from?.toLowerCase() === address.toLowerCase()) {
        outgoing.push({
          hash: txHash,
          block_number: parseInt(log.blockNumber, 16),
          to: txData.to,
          value: parseInt(txData.value || '0x0', 16) / 1e18
        });
      }
    }
    
    return outgoing;
  } catch (error) {
    console.error('Error fetching Ethereum transactions:', error);
    return [];
  }
}