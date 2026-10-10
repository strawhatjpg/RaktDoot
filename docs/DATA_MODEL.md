# Data model (planned Prisma entities)

| Entity | Key fields |
|---|---|
| User | id, phone (E.164), name, preferredLanguage, role, createdAt |
| StaffAffiliation | userId, hospitalId or bloodCentreId, verifiedBy, verifiedAt |
| DonorProfile | userId, bloodGroup, sex, travelRadiusKm, availability, unavailableUntil, lastDonationAt |
| DonorLocation | userId, lat, lng (2 decimals), areaLabel, source (WHATSAPP_SHARE / APP_GPS / MANUAL_ENTRY), updatedAt |
| Consent | userId, type, channel, granted, recordedAt, source, termsVersion |
| PushSubscription | userId, endpoint, keys, createdAt |
| Hospital | id, name, address, lat, lng, district |
| BloodCentre | id, name, licenceNo, address, lat, lng, phone, district |
| StockSnapshot | centreId, bloodGroup, component, units, status (REPORTED / CONFIRMED / RESERVED), source, isSimulated, recordedAt |
| BloodRequest | id, requesterId, hospitalId, bloodGroup, component, units, neededBy, status, verification, outcome, originalText, language |
| RequestEvent | requestId, fromStatus, toStatus, actorId, actorRole, note, createdAt |
| OutreachWave | requestId, waveNumber, radiusKm, startedAt, closesAt |
| OutreachInvite | waveId, donorId, score, scoreReasons (JSON), response, etaMinutes, respondedAt |
| DonationConfirmation | requestId, donorId, centreId, confirmedBy, confirmedAt |
| RecognitionAward | userId, kind (CERTIFICATE / BADGE), code, donationConfirmationId, awardedAt |
| PartnerOrg | id, name, type (NGO / GOVERNMENT / COLLEGE / EMPLOYER), contact |
| DonationCamp | partnerOrgId, centreId, location, startsAt |
| LoginCode | code, userId?, expiresAt, usedAt |
| ForecastRun | id, district, generatedAt, horizonWeeks, metrics (JSON), predictions (JSON), isSynthetic |
| ReminderLog | userId, channel, sentAt, templateName, status |
| AuditLog | actorId, action, entity, entityId, createdAt |