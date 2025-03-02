-- Create wallet_addresses table with proper indexing
CREATE TABLE wallet_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  blockchain TEXT NOT NULL,
  user_id UUID NOT NULL,
  alias TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX wallet_addresses_user_id_idx ON wallet_addresses(user_id);
CREATE INDEX wallet_addresses_blockchain_idx ON wallet_addresses(blockchain);
CREATE UNIQUE INDEX wallet_addresses_address_blockchain_idx ON wallet_addresses(address, blockchain);

-- Create transactions table with proper structure
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  blockchain TEXT NOT NULL,
  amount NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE,
  direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
  status TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for transactions
CREATE INDEX transactions_wallet_address_idx ON transactions(wallet_address);
CREATE INDEX transactions_blockchain_idx ON transactions(blockchain);
CREATE INDEX transactions_timestamp_idx ON transactions(timestamp);
CREATE UNIQUE INDEX transactions_tx_hash_idx ON transactions(tx_hash);

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  notification_preferences JSONB DEFAULT '{"email": true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create monitoring_state table to handle serverless environment
CREATE TABLE monitoring_state (
  id SERIAL PRIMARY KEY,
  is_monitoring BOOLEAN DEFAULT false,
  last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'idle'
);
