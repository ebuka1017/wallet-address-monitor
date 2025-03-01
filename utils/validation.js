// utils/validation.js
/**
 * Validate a wallet address based on blockchain type
 * @param {string} address - The wallet address to validate
 * @param {string} blockchain - Blockchain type (bitcoin, ethereum)
 * @returns {boolean} Whether the address is valid
 */
export function isValidAddress(address, blockchain) {
    if (!address || typeof address !== 'string') {
      return false;
    }
  
    // Convert to lowercase for consistency
    address = address.toLowerCase();
    
    if (blockchain === 'bitcoin') {
      // Bitcoin address validation
      // Check for common Bitcoin address formats
      const bitcoinRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
      return bitcoinRegex.test(address);
    } 
    
    if (blockchain === 'ethereum') {
      // Ethereum address validation
      const ethereumRegex = /^0x[a-fA-F0-9]{40}$/;
      return ethereumRegex.test(address);
    }
    
    return false;
  }
  
  /**
   * Sanitize an address string
   * @param {string} address - The address to sanitize
   * @returns {string} Sanitized address
   */
  export function sanitizeAddress(address) {
    if (!address || typeof address !== 'string') {
      return '';
    }
    
    // Convert to lowercase and remove whitespace
    return address.toLowerCase().trim();
  }
  
  /**
   * Validate transaction data
   * @param {Object} transaction - Transaction object
   * @returns {boolean} Whether the transaction is valid
   */
  export function validateTransaction(transaction) {
    // Required fields
    const requiredFields = [
      'blockchain',
      'from_address',
      'to_address',
      'tx_hash',
      'block_number'
    ];
    
    // Check required fields exist
    for (const field of requiredFields) {
      if (!transaction[field]) {
        return false;
      }
    }
    
    // Validate blockchain
    if (!['bitcoin', 'ethereum'].includes(transaction.blockchain)) {
      return false;
    }
    
    // Validate addresses
    if (!isValidAddress(transaction.from_address, transaction.blockchain) || 
        !isValidAddress(transaction.to_address, transaction.blockchain)) {
      return false;
    }
    
    // Validate transaction hash
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (transaction.blockchain === 'ethereum' && !txHashRegex.test(transaction.tx_hash)) {
      return false;
    }
    
    // Validate block number
    if (typeof transaction.block_number !== 'number' || transaction.block_number < 0) {
      return false;
    }
    
    return true;
  }