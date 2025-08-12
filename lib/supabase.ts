import { createClient } from '@supabase/supabase-js'; // Reverted to standard import path

const supabaseUrl = "https://uojzuikytfymkzemneds.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvanp1aWt5dGZ5bWt6ZW1uZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MTM1ODksImV4cCI6MjA3MDE4OTU4OX0.504Hc4dVoILVeOCiDycHfVCMSWchuzLeyOGc1OIkr8w";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };
