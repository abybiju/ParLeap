/**
 * Database Seed Utility
 * 
 * Script to populate Supabase with sample events and songs for testing
 * Run with: npx ts-node backend/src/utils/seedDatabase.ts
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';

// Sample songs with lyrics
const SAMPLE_SONGS = [
  {
    title: 'Amazing Grace',
    artist: 'John Newton',
    lyrics: `Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

Through many dangers toils and snares
I have already come
'Tis grace that brought me safe thus far
And grace will lead me home

When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we first begun`,
  },
  {
    title: 'How Great Thou Art',
    artist: 'Carl Boberg',
    lyrics: `O Lord my God when I in awesome wonder
Consider all the worlds thy hands have made
I see the stars I hear the rolling thunder
Thy power throughout the universe displayed

Then sings my soul my Savior God to thee
How great thou art how great thou art
Then sings my soul my Savior God to thee
How great thou art how great thou art

When through the woods and forest glades I wander
And hear the birds sing sweetly in the trees
If I but feel the wonder of creation
What mighty power flows out from Thee

When I in awesome wonder
Consider all the works thy hands have made
I see the stars I hear the mighty thunder
Thy power throughout the universe displayed`,
  },
  {
    title: 'Jesus Loves Me',
    artist: 'Anna Bartlett Warner',
    lyrics: `Jesus loves me this I know
For the Bible tells me so
Little ones to Him belong
They are weak but He is strong

Yes Jesus loves me
Yes Jesus loves me
Yes Jesus loves me
The Bible tells me so

Jesus loves me this I know
As He loved so long ago
Taking children on His knee
Saying let them come to me

Jesus loves me He will stay
Close beside me every day
If I love Him when I die
He will take me home on high`,
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');

  // Check if Supabase is configured
  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase is not configured!');
    console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
  }

  try {
    // Get a test user - for this demo, we'll use the service role to create test data
    // In production, you'd use actual authenticated users
    
    // First, let's create a test user via auth
    console.log('📝 Creating test user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@parleap.local',
      password: 'Test123456!',
      email_confirm: true,
    });

    if (authError) {
      console.error('❌ Error creating user:', authError);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error('❌ No user ID returned');
      return;
    }

    console.log(`✅ User created: ${userId}\n`);

    // Create profile for the user
    console.log('📝 Creating user profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          username: 'test_user',
          subscription_tier: 'pro',
        },
      ]);

    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      return;
    }

    console.log('✅ Profile created\n');

    // Create sample songs
    console.log('📝 Creating sample songs...');
    const songIds: string[] = [];

    for (const songData of SAMPLE_SONGS) {
      const { data, error } = await supabase
        .from('songs')
        .insert([
          {
            user_id: userId,
            title: songData.title,
            artist: songData.artist,
            lyrics: songData.lyrics,
          },
        ])
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Error creating song "${songData.title}":`, error);
        continue;
      }

      if (data?.id) {
        songIds.push(data.id);
        console.log(`  ✅ ${songData.title}`);
      }
    }

    console.log(`\n✅ Created ${songIds.length} songs\n`);

    // Create a test event
    console.log('📝 Creating test event...');
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert([
        {
          user_id: userId,
          name: 'Sunday Service - December 14, 2025',
          event_date: new Date('2025-12-14T10:00:00').toISOString(),
          status: 'draft',
        },
      ])
      .select('id')
      .single();

    if (eventError || !eventData) {
      console.error('❌ Error creating event:', eventError);
      return;
    }

    const eventId = eventData.id;
    console.log(`✅ Event created: ${eventId}\n`);

    // Add songs to the event setlist
    console.log('📝 Adding songs to setlist...');
    for (let i = 0; i < songIds.length; i++) {
      const { error } = await supabase
        .from('event_items')
        .insert([
          {
            event_id: eventId,
            song_id: songIds[i],
            sequence_order: i + 1,
          },
        ]);

      if (error) {
        console.error(`❌ Error adding song to setlist:`, error);
        continue;
      }

      console.log(`  ✅ Song ${i + 1} added to setlist`);
    }

    console.log('\n🎉 Database seed complete!\n');
    console.log('📊 Summary:');
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Email: test@parleap.local`);
    console.log(`  - Event ID: ${eventId}`);
    console.log(`  - Songs: ${songIds.length}`);
    console.log(`\n💡 To test the WebSocket:
  1. Start the backend: npm run dev (in backend folder)
  2. Visit: http://localhost:3000/test-websocket
  3. Enter Event ID: ${eventId}
  4. Click "Start Session"\n`);
  } catch (error) {
    console.error('❌ Seed error:', error);
  }
}

// Run the seed
seedDatabase();

