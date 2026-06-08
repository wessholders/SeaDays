# Product Brief

## Mission

SeaDays makes USCG sea service logging simple, credible, and submission-ready.

The app starts with recreational boaters working toward the OUPV / Six-Pack license. A user may be pursuing more than one credential at the same time, so SeaDays should track trips once and apply them toward multiple goals where appropriate.

## First Customer

The first user is a recreational boater who wants to become a licensed charter captain. They may not know the USCG paperwork well, may have partial historical records, and may log future trips from a phone while away from reliable service.

## Core Value

SeaDays turns scattered trip memories, notes, photos, and vessel details into a clean sea service record that can later support USCG-ready forms.

The first release should be excellent at:

- Creating a user account.
- Creating vessel profiles.
- Logging trips quickly, including offline.
- Tracking sea days toward OUPV / Six-Pack.
- Preserving an edit history for important trip fields.
- Exporting a useful sea service summary.

## USCG Scope

Primary initial credential: USCG OUPV / Six-Pack.

Known USCG/NMC submission artifacts to support over time:

- CG-719S Small Vessel Sea Service Form.
- CG-719B Merchant Mariner Credential application.
- CG-719C conviction statement, when applicable.
- CG-719P chemical testing form.
- Checklist-driven supporting document package.

SeaDays should treat official requirements and forms as versioned content. We should not hard-code regulatory assumptions into business logic without attaching an effective date and source.

## Verification

The MVP can use self-certified logs with edit history. Cross-user verification, owner/captain signatures, school verification, GPS evidence, weather evidence, and document attestations are important later trust features.

Keep this idea parked, but design the model so verification records can attach to trips later.

## Monetization

Initial testing should be free to reduce friction.

The likely business model is subscription:

- Free trial or free basic logging.
- Paid progress tracking and exports.
- Paid USCG-ready submission package.
- Later team/school/charter company plans.

Early product analytics should measure whether users keep logging, complete vessel setup, enter historical trips, and return after being offline.

## Product Principles

- Fast logging beats perfect paperwork on day one.
- Offline first is not optional.
- Users should enter a trip once and reuse it everywhere.
- Edit history matters because sea service records are sensitive.
- The app should feel like a serious records tool, not a toy nautical diary.

