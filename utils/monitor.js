import supabase from '../lib/supabase';
import { 
  determineBlockchain, 
  getCurrentBlock, 
  determineDestination,
  fetchSuspiciousAddresses
} from '../lib/blockchain';
import { fetchBitcoinTransactions, fetchEthereumTransactions } from '../lib/transaction';
import { sendEmail } from '../lib/email';

// Store monitor state
let isMonitoring = false;
let monitorInterval = null;

/**
 * Main monitoring function - checks for suspicious transactions
 */
export async function monitor() {
  console.log('Starting monitoring run...');
  
  try {
    // Fetch and store suspicious addresses
    const addresses = await fetchSuspiciousAddresses();
    
    for (const addr of addresses) {
      const blockchain = determineBlockchain(addr);
      
      if (blockchain) {
        await supabase
          .from('addresses')
          .upsert({
            address: addr.toLowerCase(),
            blockchain: blockchain,
            last_checked_block: 0
          })
          .throwOnError();
      }
    }
    
    // Get all addresses to monitor
    const { data: allAddresses, error: addressError } = await supabase
      .from('addresses')
      .select('*');
      
    if (addressError) {
      throw new Error(`Error fetching addresses: ${addressError.message}`);
    }
    
    // Process each address
    for (const addr of allAddresses) {
      const blockchain = addr.blockchain;
      const address = addr.address;
      const lastBlock = addr.last_checked_block || 0;
      const currentBlock = await getCurrentBlock(blockchain);
      
      if (!currentBlock) {
        console.log(`Could not get current block for ${blockchain}`);
        continue;
      }
      
      if (blockchain === 'bitcoin') {
        const txs = await fetchBitcoinTransactions(address, lastBlock);
        
        for (const tx of txs) {
          const amount = tx.outputs.reduce((sum, out) => sum + out.value / 1e8, 0);
          const destinations = tx.outputs.map(out => out.scriptpubkey_address);
          
          let destination = 'Unknown';
          for (const dest of destinations) {
            const label = await determineDestination(dest);
            if (label !== 'Unknown') {
              destination = label;
              break;
            }
          }
          
          const details = {
            blockchain: 'bitcoin',
            from_address: address,
            to_address: destinations.join(', '),
            amount: amount,
            token_name: 'BTC',
            tx_hash: tx.hash,
            block_number: tx.block_height,
            destination: destination
          };
          
          await supabase.from('transactions').insert(details);
          await sendEmail(details);
        }
      } else if (blockchain === 'ethereum') {
        const txs = await fetchEthereumTransactions(address, lastBlock);
        
        for (const tx of txs) {
          const toAddress = tx.to.toLowerCase();
          const destination = await determineDestination(toAddress);
          
          const details = {
            blockchain: 'ethereum',
            from_address: address,
            to_address: toAddress,
            amount: tx.value,
            token_name: 'ETH',
            tx_hash: tx.hash,
            block_number: tx.block_number,
            destination: destination
          };
          
          await supabase.from('transactions').insert(details);
          await sendEmail(details);
        }
      }
      
      // Update last checked block
      if (currentBlock) {
        await supabase
          .from('addresses')
          .update({ last_checked_block: currentBlock })
          .eq('address', address);
      }
    }
    
    console.log('Monitoring run completed');
    return true;
  } catch (error) {
    console.error('Error during monitoring:', error);
    return false;
  }
}

/**
 * Start the monitoring process
 * @param {number} intervalMinutes - Interval in minutes
 */
export function startMonitoring(intervalMinutes = 5) {
  if (isMonitoring) {
    return false;
  }
  
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Run immediately and then at intervals
  monitor();
  monitorInterval = setInterval(monitor, intervalMs);
  isMonitoring = true;
  
  return true;
}

/**
 * Stop the monitoring process
 */
export function stopMonitoring() {
  if (!isMonitoring) {
    return false;
  }
  
  clearInterval(monitorInterval);
  monitorInterval = null;
  isMonitoring = false;
  
  return true;
}

/**
 * Check if monitoring is active
 */
export function isMonitoringActive() {
  return isMonitoring;
}

/**
 * Get monitoring status
 */
export function getMonitoringStatus() {
  return {
    active: isMonitoring,
    lastRun: new Date().toISOString()
  };
}