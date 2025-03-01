/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Configure server-side environment variables
    serverRuntimeConfig: {
      // Will only be available on the server side
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY,
      GETBLOCK_BTC_URL: process.env.GETBLOCK_BTC_URL,
      GETBLOCK_ETH_URL: process.env.GETBLOCK_ETH_URL,
      GETBLOCK_BNB_URL: process.env.GETBLOCK_BNB_URL,
      MAILERSEND_API_KEY: process.env.MAILERSEND_API_KEY,
      MAILERSEND_DOMAIN: process.env.MAILERSEND_DOMAIN,
      RECEIVER_EMAIL: process.env.RECEIVER_EMAIL,
      MORALIS_API_KEY: process.env.MORALIS_API_KEY
    },
    // Configure client-side environment variables (be careful with sensitive data)
    publicRuntimeConfig: {
      // Will be available on both server and client
    }
  };
  
  module.exports = nextConfig;