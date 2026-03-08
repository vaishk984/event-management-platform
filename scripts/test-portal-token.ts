import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testToken() {
    const token = '8486ed89-a911-4344-a597-41a2a3da6640' // Token from screenshot
    console.log('Testing token:', token)

    const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .eq('client_token', token)
        .single()

    console.log('Result:', { data, error })
}

testToken()
