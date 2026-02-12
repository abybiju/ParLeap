# CCLI SongSelect API Integration - Feature Specification

**Status:** ⚠️ API Partner Program closed for new apps — pivoting to file import  
**Priority:** High (via file import), API is exploratory only  
**Estimated Timeline:** File import shipped Feb 12, 2026; API blocked by CCLI partner access  
**Last Updated:** February 12, 2026

---

## Executive Summary

Integrate CCLI SongSelect data legally and safely. The official API is **not available to new partners**; current path is:

1) **File import** (shipped): users drop their SongSelect `.usr` or `.txt` exports, we parse locally, auto-fill title/artist/CCLI/lyrics, and auto-apply community formatting.  
2) **(Optional) Credential-based scraper**: only if user-provided, encrypted credentials and compliant with CCLI ToS. Needs rotating IP + Playwright hardening.  
3) **Official API**: only if CCLI reopens the partner program; keep this doc as the design reference.

---

## Strategic Value

### Why This Feature Matters

1. **Market Fit**: Most churches already use CCLI and have SongSelect accounts.  
2. **Pain Point Solution**: File import removes manual lyric entry; community templates auto-format slides.  
3. **Legal Compliance**: Users must already have a SongSelect license and the downloaded file.  
4. **Metadata Rich**: `.usr` contains title/artist/CCLI for free.  
5. **Competitive Advantage**: Crowdsourced formatting + zero-setup import (no scraping credentials if user uses files).

### Business Impact

- **User Retention**: Reduces friction in onboarding and daily use
- **Time Savings**: Import in seconds vs. minutes of typing
- **Accuracy**: No typos or formatting errors
- **Market Positioning**: Professional integration with industry standard

---

## User Flow

```
1. User logs into ParLeap
2. Navigate to Songs Library (/songs)
3. Click "Import from CCLI" button (next to "New Song")
4. OAuth flow initiated: "Connect CCLI Account"
5. User redirected to CCLI OAuth page
6. User signs in with church CCLI credentials
7. User authorizes ParLeap to access SongSelect
8. Redirected back to ParLeap
9. ParLeap stores OAuth token (encrypted in Supabase)
10. Search interface appears: "Search CCLI SongSelect"
11. User searches by title/artist/CCLI number
12. Results displayed in modal/list
13. User selects song from results
14. ParLeap imports:
    - Title
    - Artist
    - CCLI Number
    - Formatted lyrics (with stanza breaks)
    - Song automatically saved to library
15. Success toast: "Song imported from CCLI"
16. User can immediately use song in events
```

---

## Technical Architecture

### Components Required

#### 1. OAuth Integration
**File:** `frontend/lib/auth/ccli.ts`

```typescript
// CCLI OAuth 2.0 flow
export async function connectCcliAccount(): Promise<void>
export async function getCcliToken(): Promise<string | null>
export async function refreshCcliToken(): Promise<string>
export async function disconnectCcliAccount(): Promise<void>
```

**Responsibilities:**
- Initiate OAuth 2.0 flow
- Handle OAuth callback
- Store tokens securely (encrypted in Supabase)
- Token refresh logic
- Error handling

#### 2. API Service
**File:** `frontend/lib/services/ccliApi.ts`

```typescript
// CCLI SongSelect API client
export async function searchCcliSongs(query: string): Promise<CcliSong[]>
export async function getCcliSongDetails(songId: string): Promise<CcliSongDetails>
export async function importCcliSong(songId: string): Promise<Song>
```

**Responsibilities:**
- Search songs in CCLI catalog
- Get song details (lyrics, metadata)
- Handle API rate limits
- Error handling and retries
- Request/response typing

#### 3. UI Components
**File:** `frontend/components/songs/CcliImport.tsx`

**Components:**
- `CcliConnectButton` - "Connect CCLI Account" button
- `CcliSearchModal` - Search interface modal
- `CcliSearchResults` - Results list component
- `CcliImportConfirmation` - Import confirmation dialog

**Features:**
- Search input with debouncing
- Results pagination
- Loading states
- Error messages
- Success feedback

#### 4. Database Schema
**Migration:** `supabase/migrations/003_add_ccli_integration.sql`

```sql
-- Add CCLI OAuth token to profiles (encrypted)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccli_oauth_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccli_token_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccli_connected_at TIMESTAMPTZ;

-- Add CCLI song ID to songs table (for tracking)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS ccli_song_id TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS imported_from_ccli BOOLEAN DEFAULT FALSE;
```

**Security:**
- Use Supabase encryption for OAuth tokens
- Store token expiration times
- Track connection timestamps

#### 5. Server Actions
**File:** `frontend/app/songs/actions.ts`

```typescript
// Add to existing actions
export async function importCcliSong(songId: string): Promise<ActionResult>
export async function searchCcliSongs(query: string): Promise<CcliSong[]>
export async function connectCcliAccount(): Promise<ActionResult>
```

**Responsibilities:**
- Server-side API calls (hide API keys)
- Import song to database
- Search CCLI catalog
- Handle OAuth flow server-side

---

## Implementation Phases

### Phase 1: CCLI Developer Partner Application

**Tasks:**
- [ ] Research CCLI Developer Partner program requirements
- [ ] Apply for CCLI Developer Partner program
- [ ] Get API credentials and documentation
- [ ] Review API rate limits and terms of service
- [ ] Set up OAuth application in CCLI developer portal
- [ ] Configure OAuth redirect URLs (production + development)

**Deliverables:**
- CCLI Developer Partner account approved
- API credentials obtained
- OAuth application configured
- Documentation reviewed

**Estimated Time:** 1-2 weeks (depends on CCLI approval process)

---

### Phase 2: OAuth Integration

**Tasks:**
- [ ] Create `frontend/lib/auth/ccli.ts` with OAuth flow
- [ ] Implement OAuth 2.0 authorization flow
- [ ] Handle OAuth callback route (`/auth/ccli/callback`)
- [ ] Store tokens securely in Supabase (encrypted column)
- [ ] Implement token refresh logic
- [ ] Add "Connect CCLI" button to Songs Library
- [ ] Show connection status in user profile

**Database:**
- [ ] Create migration `003_add_ccli_integration.sql`
- [ ] Add encrypted token storage
- [ ] Add connection tracking fields

**Deliverables:**
- Users can connect CCLI accounts
- Tokens stored securely
- Connection status visible

**Estimated Time:** 3-5 days

---

### Phase 3: Search & Import UI

**Tasks:**
- [ ] Create `frontend/lib/services/ccliApi.ts` API client
- [ ] Build `CcliSearchModal` component
- [ ] Implement search interface with debouncing
- [ ] Display search results in list/grid
- [ ] Add pagination for large result sets
- [ ] Create `CcliImportConfirmation` dialog
- [ ] Implement import functionality
- [ ] Add loading states and error handling
- [ ] Show success toast after import

**Server Actions:**
- [ ] Add `searchCcliSongs` server action
- [ ] Add `importCcliSong` server action
- [ ] Handle API errors gracefully
- [ ] Rate limiting considerations

**Deliverables:**
- Search interface functional
- Songs can be imported from CCLI
- Proper error handling

**Estimated Time:** 5-7 days

---

### Phase 4: Testing & Polish

**Tasks:**
- [ ] Test with real CCLI accounts (multiple churches)
- [ ] Verify stanza formatting is correct
- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh logic
- [ ] Test error scenarios (API down, rate limits, invalid tokens)
- [ ] Performance testing (search response times)
- [ ] UI/UX polish (animations, transitions)
- [ ] Accessibility testing
- [ ] Mobile responsiveness

**Deliverables:**
- Feature fully tested
- Error handling robust
- Performance optimized
- Ready for production

**Estimated Time:** 3-5 days

---

## API Integration Details

### CCLI SongSelect API Endpoints (Expected)

**Note:** Actual endpoints will be provided by CCLI after Developer Partner approval

**Search Songs:**
```
GET /api/v1/songs/search?q={query}&limit=20&offset=0
Authorization: Bearer {oauth_token}
```

**Get Song Details:**
```
GET /api/v1/songs/{songId}
Authorization: Bearer {oauth_token}
```

**OAuth Endpoints:**
```
Authorization: https://ccli.com/oauth/authorize
Token: https://ccli.com/oauth/token
```

### Data Models

```typescript
interface CcliSong {
  id: string;
  title: string;
  artist: string;
  ccliNumber: string;
  copyright?: string;
  year?: number;
}

interface CcliSongDetails extends CcliSong {
  lyrics: string; // Pre-formatted with stanza breaks
  verses: string[]; // Array of verse text
  copyright: string;
  publisher?: string;
}

interface CcliSearchResponse {
  songs: CcliSong[];
  total: number;
  limit: number;
  offset: number;
}
```

---

## Error Handling

### Scenarios to Handle

1. **OAuth Errors**
   - User denies authorization
   - Token expired
   - Invalid credentials
   - Network errors during OAuth

2. **API Errors**
   - Rate limit exceeded
   - API unavailable
   - Invalid song ID
   - Network timeouts

3. **Import Errors**
   - Duplicate song detection
   - Database errors
   - Validation failures

### Fallback Strategy

- Always allow manual entry (current method)
- Show clear error messages
- Provide retry options
- Log errors for debugging

---

## Security Considerations

1. **OAuth Tokens**
   - Store encrypted in Supabase
   - Never expose in client-side code
   - Implement token refresh
   - Handle token expiration gracefully

2. **API Keys**
   - Keep server-side only
   - Use environment variables
   - Never commit to git

3. **User Data**
   - Respect CCLI terms of service
   - Don't cache lyrics unnecessarily
   - Clear tokens on account disconnect

---

## Benefits Over Manual Entry

| Aspect | Manual Entry | CCLI Import |
|--------|-------------|-------------|
| **Time** | 5-10 minutes per song | 10-30 seconds |
| **Accuracy** | Prone to typos | 100% accurate |
| **Formatting** | Manual stanza breaks | Automatic |
| **CCLI Number** | Manual entry | Automatic |
| **Legal** | User responsible | CCLI handled |
| **Metadata** | Manual entry | Complete |

---

## Alternative Approaches (If CCLI Unavailable)

### Option 1: Manual CCLI Number Lookup
- User enters CCLI number
- ParLeap fetches song details
- Simpler but less user-friendly

### Option 2: Other Lyric Providers
- LyricFind API
- Musixmatch API
- Genius API
- Trade-off: Less church-specific

### Option 3: Community Library
- Users can share songs
- Community-curated library
- Requires moderation

---

## Success Metrics

### Adoption Metrics
- % of users who connect CCLI accounts
- % of songs imported vs. manually entered
- Average time saved per user per week

### Quality Metrics
- Import success rate
- Error rate
- User satisfaction (surveys)

### Business Metrics
- User retention improvement
- Feature usage frequency
- Competitive differentiation

---

## Dependencies

### External
- CCLI Developer Partner approval
- CCLI API access
- OAuth 2.0 support

### Internal
- Songs Library feature (already complete)
- User authentication (already complete)
- Database migrations capability (already complete)

---

## Risks & Mitigations

### Risk 1: CCLI Approval Delayed
**Mitigation:** 
- Apply early (during MVP phase)
- Have manual entry as fallback
- Consider alternatives if delayed >3 months

### Risk 2: API Rate Limits Too Restrictive
**Mitigation:**
- Implement caching
- Batch requests when possible
- Show clear rate limit messages

### Risk 3: OAuth Complexity
**Mitigation:**
- Use proven OAuth libraries
- Test thoroughly
- Provide clear user instructions

### Risk 4: Formatting Issues
**Mitigation:**
- Test with various song formats
- Allow manual editing after import
- Fallback to current parser

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Developer Partner Application | 1-2 weeks | None |
| OAuth Integration | 3-5 days | Phase 1 complete |
| Search & Import UI | 5-7 days | Phase 2 complete |
| Testing & Polish | 3-5 days | Phase 3 complete |
| **Total** | **2-3 weeks** | After MVP stable |

---

## Next Steps

1. **During MVP Phase:**
   - Research CCLI Developer Partner program
   - Start application process
   - Review API documentation

2. **Post-Launch:**
   - Begin Phase 1 (Developer Partner Application)
   - Plan implementation timeline
   - Allocate development resources

3. **Implementation:**
   - Follow phases sequentially
   - Test thoroughly at each phase
   - Gather user feedback

---

## References

- CCLI Developer Portal: https://developer.ccli.com (expected)
- CCLI SongSelect: https://songselect.ccli.com
- OAuth 2.0 Specification: https://oauth.net/2/

---

**Status:** Ready for implementation post-launch  
**Owner:** Development Team  
**Stakeholders:** Product, Engineering, Church Users
