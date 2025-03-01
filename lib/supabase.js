import { createClient } from '@supabase/supabase-js';
import getConfig from 'next/config';

// Only import server runtime config on the server
const { serverRuntimeConfig } = getConfig();

// Initialize Supabase client
const supabaseUrl = serverRuntimeConfig.SUPABASE_URL;
const supabaseKey = serverRuntimeConfig.SUPABASE_KEY;

// Create a single supabase client for the entire app
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;