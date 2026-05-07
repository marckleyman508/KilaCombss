# NeuroTrack — PHI Breach Incident Response Checklist
# HIPAA § 164.308(a)(6) — Security Incident Procedures

**Incident ID:** `BR-{YYYY}-{NNN}`  
**Detection Time:** _________________  
**Reported By:** _________________  

---

## Phase 1 — Triage (target: 15 minutes)

- [ ] Confirm PHI was actually exposed (not just attempted)
- [ ] Determine scope: how many patients? which data fields?
- [ ] Preserve all logs immediately:
  ```bash
  # Export audit_logs for the incident window
  psql $DATABASE_URL -c "\COPY (SELECT * FROM audit_logs WHERE created_at >= 'YYYY-MM-DD') TO '/forensics/audit_export.csv' CSV HEADER;"
  ```
- [ ] Assign roles:
  - Security Officer: _________________
  - Privacy Officer: _________________
  - Legal/HIPAA Counsel: _________________

---

## Phase 2 — Containment (target: 1–4 hours)

- [ ] Run breach investigation query on NeuroTrack admin endpoint:
  ```
  GET /api/admin/breach-investigation?patientMrn=MRN-XXXX&hours=72
  Authorization: Bearer <admin_token>
  ```
- [ ] Force-revoke all sessions for the compromised user:
  ```
  DELETE /api/admin/sessions/user/{userId}
  Body: { "reason": "breach_containment" }
  ```
- [ ] Rotate `JWT_SECRET` (forces all tokens invalid system-wide)
- [ ] Rotate `AUDIT_PEPPER` only if audit logs were compromised (requires rehashing existing records)
- [ ] Rotate `FIELD_ENCRYPTION_KEY` if encrypted PHI fields were decrypted (requires data re-encryption)
- [ ] On AWS: invalidate compromised IAM credentials:
  ```bash
  aws iam update-access-key --access-key-id AKIA... --status Inactive --user-name compromised-user
  ```
- [ ] Take pre-remediation DB snapshot:
  ```bash
  aws rds create-db-snapshot \
    --db-instance-identifier neurotrack-phi-db \
    --db-snapshot-identifier breach-BR-YYYY-NNN-pre-remediation
  ```

---

## Phase 3 — Investigation (target: 4–24 hours)

- [ ] Review breach investigation API output for `CRITICAL_ADMIN_PHI_ACCESS` and `ROLE_VIOLATION_BILLING` events
- [ ] Query by each affected patient's MRN:
  ```
  GET /api/admin/breach-investigation?patientMrn=MRN-2024-0001&hours=720
  ```
- [ ] Identify if data left the system (look for `EXPORT` actions, unusual IPs)
- [ ] Review `active_sessions` for concurrent sessions from unexpected locations
- [ ] Check `break_glass_log` for any admin PHI access
- [ ] Interview relevant staff if insider threat is suspected

---

## Phase 4 — Risk Assessment (target: 24–48 hours)

**Low probability (no notification required):**
- Encrypted data accessed without the decryption key
- All audit log `status = 'denied'` (access attempted, not granted)
- Internal test environment with synthetic PHI only

**High probability (notification REQUIRED):**
- Unencrypted PHI viewed by unauthorized person
- `EXPORT` action logged from unauthorized user
- Laptop/device with PHI lost or stolen (assume worst case)
- `FIELD_ENCRYPTION_KEY` or `AUDIT_PEPPER` exposed

- [ ] Draft risk assessment memo (signed by Security Officer)
- [ ] Decision: **NOTIFY** ☐  |  **DO NOT NOTIFY** ☐  (documented reason required)

---

## Phase 5 — Notification (if high probability, within 60 days)

- [ ] Identify all affected patients from `patient_id_hash` in breach investigation results
  - Reverse-lookup: `SELECT mrn FROM patients WHERE HMAC(mrn, pepper) = '<hash>'` via admin DB tool
- [ ] Prepare breach notification letter (template in `/docs/breach_notification_template.md`)
- [ ] Submit to HHS OCR portal: https://ocrportal.hhs.gov/ocr/smartscreen/main.jsf
  - If 500+ records: also notify prominent local media within 60 days
- [ ] Notify affected individuals (first-class mail or email if preferred)
- [ ] Offer credit monitoring if SSN or financial data involved
- [ ] Log breach in breach register (retain 6 years per HIPAA § 164.530(j))

---

## Phase 6 — Remediation (target: 30 days)

- [ ] Implement corrective action (code fix, policy update, access revocation)
- [ ] Retrain affected staff on PHI handling
- [ ] Update risk assessment for next annual security audit
- [ ] Re-run `npm audit` and dependency vulnerability scan
- [ ] Verify Terraform compliance checklist (see below)
- [ ] Close incident: **Date closed:** __________

---

## Go-Live / Post-Remediation Compliance Checks

| Requirement | Command / Check |
|-------------|-----------------|
| TLS 1.2+ only (no HTTP) | `nmap --script ssl-enum-ciphers -p 443 yourdomain.com` |
| No port 80 exposed | Check ALB security group — port 80 must redirect only, not open |
| RDS encryption | `aws rds describe-db-instances --query "DBInstances[0].StorageEncrypted"` → `true` |
| RDS force_ssl | `aws rds describe-db-parameters --db-parameter-group-name neurotrack-hipaa-pg15 \| grep force_ssl` → `1` |
| S3 Object Lock (6yr) | `aws s3api get-object-lock-configuration --bucket neurotrack-audit-logs-*` → `COMPLIANCE, 2190 days` |
| CloudTrail active | `aws cloudtrail get-trail-status --name neurotrack-hipaa-trail` → `IsLogging: true` |
| CloudTrail integrity | `aws cloudtrail validate-logs --trail-arn arn:aws:cloudtrail:...` |
| No wildcard IAM actions on PHI | `aws iam simulate-principal-policy` with `s3:*` or `rds:*` → should DENY |
| AUDIT_PEPPER set | `echo $AUDIT_PEPPER \| wc -c` → >= 32 |
| FIELD_ENCRYPTION_KEY set | `echo $FIELD_ENCRYPTION_KEY \| wc -c` → exactly 65 (64 chars + newline) |
| MFA enrolled for all admin/doctor users | `GET /api/admin/sessions` → all admin/doctor entries have `mfaVerifiedAt != null` |
| BAA signed with AWS | AWS Artifact console → Agreements → Active |
