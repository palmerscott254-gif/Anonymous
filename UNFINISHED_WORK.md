# Unfinished Work Roadmap

This document tracks the remaining work needed to turn GhostChat into a fully featured, production-ready app.

## 1. Core Messaging
- [ ] Persist messages in a database instead of RAM
- [ ] Support message edit and delete actions
- [ ] Add reactions and thread replies
- [ ] Add read receipts and delivery states
- [ ] Add typing indicators with better presence sync
- [ ] Add search within conversations
- [ ] Add pinned messages
- [ ] Add message forwarding
- [ ] Add message quoting / reply preview
- [ ] Add offline send queue and retry logic

## 2. Identity and Accounts
- [ ] Add proper authentication and account recovery
- [ ] Support anonymous and signed-in modes
- [ ] Add device/session management
- [ ] Add profile avatars and richer profile customization
- [ ] Add username uniqueness rules where needed
- [ ] Add profile export/import

## 3. Room and Group System
- [ ] Persist rooms and memberships in a database
- [ ] Add group invite codes with expiry and revocation
- [ ] Add invite links and QR codes
- [ ] Add member roles: owner, admin, moderator, member
- [ ] Add group settings and permissions
- [ ] Add group member management and bans
- [ ] Add join requests / approval flow
- [ ] Add room history and room archive views
- [ ] Add room deletion and cleanup controls

## 4. File Sharing
- [ ] Add image upload with preview and compression
- [ ] Add document, audio, and video transfer
- [ ] Add resumable uploads and downloads
- [ ] Add file transfer protocol with progress tracking
- [ ] Add virus/malware scanning or file validation
- [ ] Add file size limits and type restrictions
- [ ] Add attachment storage strategy
- [ ] Add attachment download history
- [ ] Add drag-and-drop file sending

## 5. Voice and Video
- [ ] Add voice calls
- [ ] Add video calls
- [ ] Add screen sharing
- [ ] Add call ringing, accept, reject, and hang-up flows
- [ ] Add STUN/TURN configuration
- [ ] Add call quality indicators
- [ ] Add call history and missed call states

## 6. Encryption and Privacy
- [ ] Implement real end-to-end encryption
- [ ] Add key exchange and key rotation
- [ ] Add secure local key storage
- [ ] Add encrypted attachments
- [ ] Add message signing and integrity checks
- [ ] Add privacy-preserving metadata minimization
- [ ] Add secret chat expiration policies
- [ ] Add screenshot / screen-recording warnings where possible

## 7. Notifications and Background Work
- [ ] Add push notifications
- [ ] Add background sync
- [ ] Add badge counts
- [ ] Add notification settings per room
- [ ] Add Android foreground/background handling
- [ ] Add reconnect and resend behavior after app resume

## 8. Android Optimization
- [ ] Reduce app startup time
- [ ] Reduce memory usage
- [ ] Reduce battery usage in background activity
- [ ] Improve socket reconnection on mobile networks
- [ ] Optimize large-list rendering
- [ ] Improve touch targets and gesture handling
- [ ] Improve keyboard and input behavior on Android
- [ ] Add safe area and orientation handling
- [ ] Test on low-end Android devices

## 9. Performance and Scalability
- [ ] Move from in-memory storage to persistent storage
- [ ] Add caching for recent data
- [ ] Add pagination / lazy loading for message history
- [ ] Add server-side rate limiting
- [ ] Add horizontal scaling support
- [ ] Add better room cleanup and pruning
- [ ] Add metrics and performance monitoring
- [ ] Add load testing

## 10. Search and Discovery
- [ ] Add room and contact search
- [ ] Add invite code lookup UX
- [ ] Add recent rooms and recent contacts
- [ ] Add filter and sort controls
- [ ] Add global search for messages, files, and groups

## 11. UX and UI Polish
- [ ] Create a consistent design system
- [ ] Improve empty states
- [ ] Improve loading states and skeletons
- [ ] Add animation polish
- [ ] Add dark/light mode or theme presets
- [ ] Improve accessibility and contrast
- [ ] Add keyboard navigation support
- [ ] Add responsive layouts for mobile and desktop
- [ ] Add better error messaging and recovery flows

## 12. Admin and Safety
- [ ] Add moderation tools
- [ ] Add abuse reporting
- [ ] Add spam detection
- [ ] Add content filtering options
- [ ] Add room-level audit logs
- [ ] Add rate-limited invite generation
- [ ] Add anti-abuse protections for file sharing

## 13. Infrastructure and DevOps
- [ ] Add environment-based config
- [ ] Add secrets management
- [ ] Add CI checks for build and lint
- [ ] Add automated tests
- [ ] Add deployment pipeline
- [ ] Add observability logs and alerts
- [ ] Add backup and restore strategy
- [ ] Add migration strategy for future schema changes

## 14. Testing and QA
- [ ] Add unit tests for utilities and state logic
- [ ] Add integration tests for sockets and rooms
- [ ] Add E2E tests for chat flows
- [ ] Add mobile device testing
- [ ] Add regression tests for file transfer
- [ ] Add security tests
- [ ] Add accessibility tests

## 15. Product Features
- [ ] Add message scheduling
- [ ] Add polls and surveys
- [ ] Add voice notes
- [ ] Add stickers and GIFs
- [ ] Add channel-style broadcasts
- [ ] Add contact favorites
- [ ] Add status / presence customization
- [ ] Add unread summaries
- [ ] Add export chat history
- [ ] Add import chat backup

## 16. Final Product Goals
- [ ] Ship a stable production release
- [ ] Support secure group invites
- [ ] Support full file sharing
- [ ] Support mobile-first Android performance
- [ ] Support encrypted real-time communication
- [ ] Support scalable backend persistence
- [ ] Support a polished, modern UI
- [ ] Support testing and deployment automation

## Priority Order
1. Persistence and authentication
2. Real end-to-end encryption
3. Group invite codes and group management
4. File sharing and attachments
5. Android optimization
6. Notifications and background sync
7. Voice/video calling
8. Performance, testing, and deployment

## Next Implementation Sprint
- [ ] Define database schema
- [ ] Add file upload storage
- [ ] Add invite code generation and validation
- [ ] Add attachment UI and backend transport
- [ ] Improve Android performance settings
- [ ] Add core automated tests
- [ ] Add deployment-ready environment config
