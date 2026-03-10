#!/usr/bin/env npx tsx
/**
 * Seeds a Solid Pod with detailed example education data for one student.
 *
 * Creates an `education/` container with profile, test scores across multiple
 * terms, learning plans, teacher notes, attendance, course schedule,
 * extracurriculars, disciplinary record, health info, and report cards.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/seed-education-data.ts
 *
 * Reads SOLID_CLIENT_ID and SOLID_CLIENT_SECRET from .env (or environment).
 */

import { Session } from "@inrupt/solid-client-authn-node";
import { getPodUrlAll } from "@inrupt/solid-client";

const OIDC_ISSUER = "https://login.inrupt.com";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Turtle content for each file
// ---------------------------------------------------------------------------

const PREFIXES = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .
@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
`;

const profile = `${PREFIXES}

<#me>
  a foaf:Person, edu:Student ;
  foaf:name "Emma Chen" ;
  foaf:givenName "Emma" ;
  foaf:familyName "Chen" ;
  foaf:age 14 ;
  foaf:birthday "2010-03-22" ;
  schema:email "emma.chen@school.example.org" ;
  edu:studentId "STU-2024-0147" ;
  edu:gradeLevel 9 ;
  edu:enrollmentDate "2024-09-01"^^xsd:date ;
  edu:school "Westfield High School" ;
  edu:district "Westfield Unified School District" ;
  edu:homeroom "Room 204 — Ms. Rodriguez" ;
  edu:locker "B-247" ;
  edu:busRoute "Route 12 — Cedar Hills" .

<#guardian-1>
  a edu:Guardian ;
  foaf:name "Li Chen" ;
  edu:relationship "Mother" ;
  schema:email "li.chen@example.org" ;
  schema:telephone "(555) 234-8901" ;
  edu:employer "Chen & Associates Architecture" ;
  edu:primaryContact true ;
  edu:emergencyContact true .

<#guardian-2>
  a edu:Guardian ;
  foaf:name "David Chen" ;
  edu:relationship "Father" ;
  schema:email "david.chen@example.org" ;
  schema:telephone "(555) 234-8902" ;
  edu:employer "Westfield Memorial Hospital — Radiology Dept" ;
  edu:primaryContact false ;
  edu:emergencyContact true .

<#emergency-contact>
  a edu:EmergencyContact ;
  foaf:name "Margaret Chen" ;
  edu:relationship "Paternal Grandmother" ;
  schema:telephone "(555) 234-0055" ;
  edu:notes "Lives 10 min from school. Authorized for pickup." .

<#previous-school>
  a edu:TransferRecord ;
  edu:schoolName "Cedar Hills Middle School" ;
  edu:district "Westfield Unified School District" ;
  edu:yearsAttended "2021-2024" ;
  edu:graduatingGpa "3.7" ;
  edu:notes "Strong student. Recommended for honors math track." .
`;

const schedule = `${PREFIXES}

<#schedule-fall-2024>
  a edu:CourseSchedule ;
  edu:student <profile#me> ;
  edu:term "Fall 2024" ;
  dct:created "${today()}"^^xsd:date .

<#period-1>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 1 ;
  edu:time "7:45 — 8:35" ;
  edu:courseName "Algebra I" ;
  edu:courseCode "MATH-1010" ;
  edu:instructor "Mr. Thompson" ;
  edu:room "Room 302" ;
  edu:credits 1.0 ;
  edu:type "Required — Core" .

<#period-2>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 2 ;
  edu:time "8:40 — 9:30" ;
  edu:courseName "English Language Arts 9" ;
  edu:courseCode "ELA-0900" ;
  edu:instructor "Ms. Rodriguez" ;
  edu:room "Room 204" ;
  edu:credits 1.0 ;
  edu:type "Required — Core" .

<#period-3>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 3 ;
  edu:time "9:35 — 10:25" ;
  edu:courseName "Biology" ;
  edu:courseCode "SCI-1010" ;
  edu:instructor "Dr. Patel" ;
  edu:room "Room 415 (Lab)" ;
  edu:credits 1.0 ;
  edu:type "Required — Core" .

<#period-4>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 4 ;
  edu:time "10:30 — 11:20" ;
  edu:courseName "World History" ;
  edu:courseCode "HIST-1010" ;
  edu:instructor "Mr. Okafor" ;
  edu:room "Room 118" ;
  edu:credits 1.0 ;
  edu:type "Required — Core" .

<#lunch>
  a edu:ScheduleBlock ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 0 ;
  edu:time "11:20 — 12:00" ;
  edu:label "Lunch — Cafeteria B" .

<#period-5>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 5 ;
  edu:time "12:05 — 12:55" ;
  edu:courseName "Spanish II" ;
  edu:courseCode "LANG-2020" ;
  edu:instructor "Sra. Gutierrez" ;
  edu:room "Room 210" ;
  edu:credits 1.0 ;
  edu:type "Elective — World Language" .

<#period-6>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 6 ;
  edu:time "1:00 — 1:50" ;
  edu:courseName "Introduction to Computer Science" ;
  edu:courseCode "CS-1010" ;
  edu:instructor "Mr. Liu" ;
  edu:room "Room 105 (Computer Lab)" ;
  edu:credits 0.5 ;
  edu:type "Elective — Technology" .

<#period-7>
  a edu:CourseEnrollment ;
  edu:schedule <#schedule-fall-2024> ;
  edu:period 7 ;
  edu:time "1:55 — 2:45" ;
  edu:courseName "Physical Education" ;
  edu:courseCode "PE-0900" ;
  edu:instructor "Coach Davis" ;
  edu:room "Gymnasium" ;
  edu:credits 0.5 ;
  edu:type "Required — Health/PE" .
`;

const testScores = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# ── Mathematics ─────────────────────────────────────────────────────

<#math-diagnostic-sep>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Diagnostic Placement Assessment" ;
  edu:score 82 ;
  edu:maxScore 100 ;
  edu:percentile 79 ;
  edu:grade "B" ;
  edu:date "2024-09-05"^^xsd:date ;
  edu:assessor "Mr. Thompson" ;
  edu:notes "Strong arithmetic and pre-algebra foundations. Some gaps in function notation and graphing. Placed in standard Algebra I (not honors) — revisit for spring." .

<#math-quiz-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Quiz 1 — Variables and Expressions" ;
  edu:score 19 ;
  edu:maxScore 20 ;
  edu:grade "A" ;
  edu:date "2024-09-20"^^xsd:date ;
  edu:assessor "Mr. Thompson" .

<#math-quiz-2>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Quiz 2 — Solving Linear Equations" ;
  edu:score 20 ;
  edu:maxScore 20 ;
  edu:grade "A+" ;
  edu:date "2024-10-04"^^xsd:date ;
  edu:assessor "Mr. Thompson" .

<#math-quiz-3>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Quiz 3 — Inequalities" ;
  edu:score 18 ;
  edu:maxScore 20 ;
  edu:grade "A" ;
  edu:date "2024-10-08"^^xsd:date ;
  edu:assessor "Mr. Thompson" .

<#math-test-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Unit Test — Chapters 1-3" ;
  edu:score 88 ;
  edu:maxScore 100 ;
  edu:percentile 84 ;
  edu:grade "B+" ;
  edu:date "2024-10-18"^^xsd:date ;
  edu:assessor "Mr. Thompson" ;
  edu:notes "Solid on equations and inequalities. Lost points on two word problems — misread the setup. Computation was correct once she set them up right." .

<#math-midterm-fall>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Fall Midterm Examination" ;
  edu:score 92 ;
  edu:maxScore 100 ;
  edu:percentile 88 ;
  edu:grade "A" ;
  edu:date "2024-11-15"^^xsd:date ;
  edu:assessor "Mr. Thompson" ;
  edu:notes "Excellent grasp of linear equations and graphing. Minor errors in word problems — improving on this compared to Unit Test. Top 5 in the class." .

<#math-quiz-4>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Quiz 4 — Systems of Equations" ;
  edu:score 17 ;
  edu:maxScore 20 ;
  edu:grade "B+" ;
  edu:date "2024-12-06"^^xsd:date ;
  edu:assessor "Mr. Thompson" ;
  edu:notes "Got the substitution method down perfectly. Made an error on the elimination method problem." .

<#math-final-fall>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Mathematics — Algebra I" ;
  edu:testName "Fall Semester Final Exam" ;
  edu:score 90 ;
  edu:maxScore 100 ;
  edu:percentile 86 ;
  edu:grade "A-" ;
  edu:date "2025-01-10"^^xsd:date ;
  edu:assessor "Mr. Thompson" ;
  edu:notes "Consistent performance. Strong on graphing and systems. Still occasionally rushes word problems but catching herself more often." .

# ── English Language Arts ────────────────────────────────────────────

<#ela-journal-sep>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Reading Response Journal — September" ;
  edu:score 42 ;
  edu:maxScore 50 ;
  edu:grade "B+" ;
  edu:date "2024-09-30"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" ;
  edu:notes "Thoughtful responses but entries are sometimes too brief. Needs to develop ideas more fully." .

<#ela-essay-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Persuasive Essay — Climate Action" ;
  edu:score 85 ;
  edu:maxScore 100 ;
  edu:percentile 76 ;
  edu:grade "B+" ;
  edu:date "2024-10-22"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" ;
  edu:notes "Strong thesis and evidence. Needs tighter paragraph transitions. Conclusion was rushed — ran out of time (extended time accommodation was offered but declined)." .

<#ela-vocab-quiz>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Vocabulary Quiz — Unit 3" ;
  edu:score 28 ;
  edu:maxScore 30 ;
  edu:grade "A" ;
  edu:date "2024-10-11"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" .

<#ela-presentation>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Oral Presentation — Book Talk (The Giver)" ;
  edu:score 90 ;
  edu:maxScore 100 ;
  edu:grade "A-" ;
  edu:date "2024-11-08"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" ;
  edu:notes "Clearly prepared and passionate about the book. Good eye contact. Spoke a bit fast — nerves. Q&A section was excellent." .

<#ela-midterm>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Fall Midterm — Reading Comprehension & Grammar" ;
  edu:score 87 ;
  edu:maxScore 100 ;
  edu:percentile 80 ;
  edu:grade "B+" ;
  edu:date "2024-11-14"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" ;
  edu:notes "Strong reading comprehension. Grammar section was near-perfect. Lost points on the extended response — same transition issue from the essay." .

<#ela-essay-2>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "English Language Arts" ;
  edu:testName "Analytical Essay — To Kill a Mockingbird" ;
  edu:score 91 ;
  edu:maxScore 100 ;
  edu:percentile 85 ;
  edu:grade "A-" ;
  edu:date "2024-12-12"^^xsd:date ;
  edu:assessor "Ms. Rodriguez" ;
  edu:notes "Significant improvement in essay structure! Transitions between paragraphs are much smoother. Strong thesis connecting the novel to modern justice. Best essay of the semester." .

# ── Biology ──────────────────────────────────────────────────────────

<#bio-quiz-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Quiz — Scientific Method" ;
  edu:score 9 ;
  edu:maxScore 10 ;
  edu:grade "A" ;
  edu:date "2024-09-18"^^xsd:date ;
  edu:assessor "Dr. Patel" .

<#bio-lab-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Lab Report — Microscope Observation (Onion Cells)" ;
  edu:score 88 ;
  edu:maxScore 100 ;
  edu:grade "B+" ;
  edu:date "2024-09-27"^^xsd:date ;
  edu:assessor "Dr. Patel" ;
  edu:notes "Good observations and diagrams. Needs to be more precise in measurement recording." .

<#bio-test-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Unit Test — Cell Structure & Function" ;
  edu:score 91 ;
  edu:maxScore 100 ;
  edu:percentile 84 ;
  edu:grade "A-" ;
  edu:date "2024-10-16"^^xsd:date ;
  edu:assessor "Dr. Patel" ;
  edu:notes "Excellent understanding of organelle functions. One error on the cell membrane transport diagram." .

<#bio-lab-2>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Lab Report — Photosynthesis Experiment" ;
  edu:score 95 ;
  edu:maxScore 100 ;
  edu:grade "A" ;
  edu:date "2024-11-05"^^xsd:date ;
  edu:assessor "Dr. Patel" ;
  edu:notes "Outstanding methodology section. Hypothesis clearly stated. Only student to include a proper error analysis section. Asked to present methodology to the class." .

<#bio-midterm>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Fall Midterm — Cells, Photosynthesis, Respiration" ;
  edu:score 93 ;
  edu:maxScore 100 ;
  edu:percentile 89 ;
  edu:grade "A" ;
  edu:date "2024-11-19"^^xsd:date ;
  edu:assessor "Dr. Patel" ;
  edu:notes "One of the top performers. Particularly strong on the photosynthesis vs. respiration comparison question." .

<#bio-lab-3>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Biology" ;
  edu:testName "Lab Report — DNA Extraction (Strawberry)" ;
  edu:score 92 ;
  edu:maxScore 100 ;
  edu:grade "A-" ;
  edu:date "2024-12-04"^^xsd:date ;
  edu:assessor "Dr. Patel" ;
  edu:notes "Clean procedure, good results. Conclusion section could dig deeper into why the detergent step works at a molecular level." .

# ── World History ────────────────────────────────────────────────────

<#hist-quiz-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "Map Quiz — Ancient Civilizations Geography" ;
  edu:score 14 ;
  edu:maxScore 20 ;
  edu:grade "C" ;
  edu:date "2024-09-25"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Mixed up locations of Tigris/Euphrates. Correct on Egypt and China." .

<#hist-dbq-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "DBQ Practice — Hammurabi's Code" ;
  edu:score 5 ;
  edu:maxScore 10 ;
  edu:grade "C" ;
  edu:date "2024-10-09"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Summarized the documents but didn't analyze them. Needs to connect evidence to a thesis. This is the core skill to develop." .

<#hist-test-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "Unit Test — Mesopotamia & Egypt" ;
  edu:score 81 ;
  edu:maxScore 100 ;
  edu:percentile 65 ;
  edu:grade "B-" ;
  edu:date "2024-10-23"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Good on factual recall. Struggled with the comparison essay section. Egypt knowledge is solid; Mesopotamia needs work." .

<#hist-midterm>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "Fall Midterm — Ancient Civilizations" ;
  edu:score 78 ;
  edu:maxScore 100 ;
  edu:percentile 62 ;
  edu:grade "C+" ;
  edu:date "2024-11-18"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Solid on Egypt and Mesopotamia, weaker on Indus Valley. DBQ section improved slightly but still below target. Started attending office hours this week." .

<#hist-dbq-2>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "DBQ Practice — Compare Two Civilizations" ;
  edu:score 8 ;
  edu:maxScore 10 ;
  edu:grade "B+" ;
  edu:date "2024-12-04"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Major improvement! Thesis is clear. Used 4 of 5 documents as evidence. Still needs to consider counterarguments but the analytical leap is happening." .

<#hist-project>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "World History" ;
  edu:testName "Group Project — Ancient China Presentation" ;
  edu:score 88 ;
  edu:maxScore 100 ;
  edu:grade "B+" ;
  edu:date "2024-12-13"^^xsd:date ;
  edu:assessor "Mr. Okafor" ;
  edu:notes "Emma led the research section of the group presentation. Her slides on the Silk Road were the strongest part. Good teamwork — she organized the group effectively." .

# ── Spanish II ───────────────────────────────────────────────────────

<#span-quiz-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Spanish II" ;
  edu:testName "Quiz — Preterite Regular Verbs" ;
  edu:score 16 ;
  edu:maxScore 20 ;
  edu:grade "B" ;
  edu:date "2024-09-27"^^xsd:date ;
  edu:assessor "Sra. Gutierrez" ;
  edu:notes "Some confusion between -ar and -er/-ir preterite endings." .

<#span-test-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Spanish II" ;
  edu:testName "Unit Test — Preterite vs. Imperfect" ;
  edu:score 83 ;
  edu:maxScore 100 ;
  edu:grade "B" ;
  edu:date "2024-10-25"^^xsd:date ;
  edu:assessor "Sra. Gutierrez" ;
  edu:notes "Good grasp of when to use each tense conceptually. Verb conjugation accuracy needs improvement — especially irregular verbs." .

<#span-oral>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Spanish II" ;
  edu:testName "Oral Proficiency Assessment" ;
  edu:score 88 ;
  edu:maxScore 100 ;
  edu:grade "B+" ;
  edu:date "2024-12-03"^^xsd:date ;
  edu:assessor "Sra. Gutierrez" ;
  edu:notes "Good conversational flow. Some verb conjugation hesitation in preterite tense. Pronunciation is excellent — clearly practices outside class." .

# ── Computer Science ─────────────────────────────────────────────────

<#cs-project-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Intro to Computer Science" ;
  edu:testName "Project 1 — Personal Web Page (HTML/CSS)" ;
  edu:score 95 ;
  edu:maxScore 100 ;
  edu:grade "A" ;
  edu:date "2024-10-04"^^xsd:date ;
  edu:assessor "Mr. Liu" ;
  edu:notes "Clean, well-structured code. Added responsive design features that weren't required. Clearly has a knack for this." .

<#cs-quiz-1>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Intro to Computer Science" ;
  edu:testName "Quiz — Variables, Loops, Conditionals (Python)" ;
  edu:score 10 ;
  edu:maxScore 10 ;
  edu:grade "A+" ;
  edu:date "2024-11-01"^^xsd:date ;
  edu:assessor "Mr. Liu" .

<#cs-project-2>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Intro to Computer Science" ;
  edu:testName "Project 2 — Text Adventure Game (Python)" ;
  edu:score 98 ;
  edu:maxScore 100 ;
  edu:grade "A+" ;
  edu:date "2024-12-10"^^xsd:date ;
  edu:assessor "Mr. Liu" ;
  edu:notes "Went far beyond requirements. Implemented a save/load system, inventory management, and ASCII art. Code is well-organized with functions and comments. Strongest project in the class." .

# ── Physical Education ───────────────────────────────────────────────

<#pe-fitness>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Physical Education" ;
  edu:testName "Fall Fitness Assessment" ;
  edu:score 82 ;
  edu:maxScore 100 ;
  edu:grade "B" ;
  edu:date "2024-10-15"^^xsd:date ;
  edu:assessor "Coach Davis" ;
  edu:notes "Good overall fitness. Mile time 9:12. Above average flexibility. Could improve upper body strength." .

# ── Standardized Testing ────────────────────────────────────────────

<#psat-8-9>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Standardized — PSAT 8/9" ;
  edu:testName "PSAT 8/9 (taken in 8th grade)" ;
  edu:score 1050 ;
  edu:maxScore 1440 ;
  edu:percentile 82 ;
  edu:date "2024-04-10"^^xsd:date ;
  edu:assessor "College Board" ;
  edu:notes "Evidence-Based Reading & Writing: 540. Math: 510. Benchmark met for both sections. On track for college readiness." .

<#map-reading-fall>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Standardized — MAP Reading" ;
  edu:testName "MAP Growth — Reading (Fall)" ;
  edu:score 224 ;
  edu:maxScore 260 ;
  edu:percentile 78 ;
  edu:date "2024-09-12"^^xsd:date ;
  edu:assessor "NWEA" ;
  edu:notes "Grade-level performance. Strong in literary text comprehension. Informational text analysis is an area for growth." .

<#map-math-fall>
  a edu:TestScore ;
  edu:student <profile#me> ;
  edu:subject "Standardized — MAP Math" ;
  edu:testName "MAP Growth — Mathematics (Fall)" ;
  edu:score 231 ;
  edu:maxScore 260 ;
  edu:percentile 85 ;
  edu:date "2024-09-12"^^xsd:date ;
  edu:assessor "NWEA" ;
  edu:notes "Above grade level. Operations & algebraic thinking are strongest areas. Geometry is the relative weakness." .
`;

const learningPlan = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# ── IEP Summary ──────────────────────────────────────────────────────

<#iep-current>
  a edu:IndividualEducationPlan ;
  edu:student <profile#me> ;
  edu:iepDate "2024-08-15"^^xsd:date ;
  edu:nextReviewDate "2025-08-15"^^xsd:date ;
  edu:eligibilityCategory "Specific Learning Disability — Written Expression" ;
  edu:caseManager "Dr. Kim (School Counselor)" ;
  edu:parentConsent true ;
  edu:summary """Emma qualifies for an IEP under Specific Learning Disability in the area of written expression. She demonstrates strong verbal reasoning and mathematical ability, but has difficulty organizing written work under time pressure. Her processing speed is in the low-average range, which impacts timed assessments. Accommodations focus on extended time and structured writing supports.""" .

<#accommodation-time>
  a edu:Accommodation ;
  edu:iep <#iep-current> ;
  edu:type "Extended Time" ;
  edu:details "1.5x time on all timed assessments across all subjects." ;
  edu:implementationNotes "Teacher provides a quiet location for extended-time testing. Emma sometimes declines the accommodation — teachers should encourage her to use it." ;
  edu:approvedBy "Student Services — Dr. Kim" .

<#accommodation-graphic-organizer>
  a edu:Accommodation ;
  edu:iep <#iep-current> ;
  edu:type "Graphic Organizer for Writing" ;
  edu:details "Provide graphic organizer or outline template before any essay or extended writing assignment." ;
  edu:implementationNotes "Ms. Rodriguez provides these in ELA. Mr. Okafor uses them for DBQs in History. Emma reports they help her organize thoughts before writing." ;
  edu:approvedBy "Student Services — Dr. Kim" .

<#accommodation-preferential-seating>
  a edu:Accommodation ;
  edu:iep <#iep-current> ;
  edu:type "Preferential Seating" ;
  edu:details "Seat near the front of the classroom, away from high-traffic areas." ;
  edu:implementationNotes "Helps Emma focus during instruction. All teachers have been notified." ;
  edu:approvedBy "Student Services — Dr. Kim" .

# ── Learning Plan (Fall 2024) ────────────────────────────────────────

<#plan-2024-fall>
  a edu:LearningPlan ;
  edu:student <profile#me> ;
  edu:term "Fall 2024" ;
  edu:createdDate "${today()}"^^xsd:date ;
  edu:advisor "Ms. Rodriguez" ;
  edu:overallStatus "On Track" ;
  edu:gpa "3.6" .

<#goal-math>
  a edu:LearningGoal ;
  edu:plan <#plan-2024-fall> ;
  edu:subject "Mathematics" ;
  edu:description "Maintain A average in Algebra I; prepare for potential Honors Geometry placement in spring" ;
  edu:targetDate "2025-01-15"^^xsd:date ;
  edu:status "Achieved" ;
  edu:strategy "Weekly problem sets from Chapters 7-9. Khan Academy supplemental videos on coordinate geometry. Meet with Mr. Thompson monthly to assess honors readiness." ;
  edu:outcome "Final exam A-. Recommended for Honors Geometry in spring." .

<#goal-history>
  a edu:LearningGoal ;
  edu:plan <#plan-2024-fall> ;
  edu:subject "World History" ;
  edu:description "Improve primary source analysis skills; raise grade to B by end of semester" ;
  edu:targetDate "2025-01-15"^^xsd:date ;
  edu:status "Achieved" ;
  edu:strategy "Bi-weekly office hours with Mr. Okafor. Practice DBQ (document-based question) essays using graphic organizer accommodation. Read supplementary chapters on Indus Valley." ;
  edu:outcome "DBQ score improved from 5/10 to 8/10. Group project B+. Semester grade: B. Goal met." .

<#goal-writing>
  a edu:LearningGoal ;
  edu:plan <#plan-2024-fall> ;
  edu:subject "English Language Arts" ;
  edu:description "Strengthen essay structure — focus on paragraph transitions and conclusion writing" ;
  edu:targetDate "2025-01-15"^^xsd:date ;
  edu:status "Achieved" ;
  edu:strategy "Writing workshop Tuesdays after school. Use graphic organizer before every essay. Peer review partnership with Aisha Johnson." ;
  edu:outcome "Essay scores improved from B+ (85) to A- (91). Ms. Rodriguez noted 'significant improvement in essay structure' on final essay." .

<#goal-cs>
  a edu:LearningGoal ;
  edu:plan <#plan-2024-fall> ;
  edu:subject "Computer Science" ;
  edu:description "Complete Intro to CS course; explore whether to continue into AP CS Principles" ;
  edu:targetDate "2025-01-15"^^xsd:date ;
  edu:status "Exceeded" ;
  edu:strategy "Engage fully with course projects. Attend optional Friday coding sessions." ;
  edu:outcome "Strongest student in the class per Mr. Liu. Registered for AP CS Principles for spring. Also joined Robotics Club." .

<#goal-sel>
  a edu:LearningGoal ;
  edu:plan <#plan-2024-fall> ;
  edu:subject "Social-Emotional" ;
  edu:description "Build confidence in using IEP accommodations; develop self-advocacy skills" ;
  edu:targetDate "2025-01-15"^^xsd:date ;
  edu:status "In Progress" ;
  edu:strategy "Monthly check-in with Dr. Kim. Practice requesting accommodations independently. Journaling about test anxiety." ;
  edu:outcome "Still sometimes declines extended time. More willing to use graphic organizers. Will continue working on this in spring." .
`;

const teacherNotes = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# ── September ────────────────────────────────────────────────────────

<#note-rodriguez-sep-1>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Ms. Rodriguez (English / Homeroom)" ;
  edu:date "2024-09-10"^^xsd:date ;
  edu:category "Transition" ;
  edu:content """First week check-in. Emma is adjusting to high school well. She's quiet but attentive. Found her reading during lunch — connected her with Aisha Johnson who also loves sci-fi. They hit it off immediately. Will keep an eye on social integration.""" .

<#note-thompson-sep>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Thompson (Mathematics)" ;
  edu:date "2024-09-15"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's diagnostic shows she's well-prepared for Algebra I. Considered recommending her for the honors section but she seemed anxious about it during our conversation. Going to let her build confidence in the standard track first. May revisit for spring semester.""" .

# ── October ──────────────────────────────────────────────────────────

<#note-okafor-oct>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Okafor (World History)" ;
  edu:date "2024-10-10"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's first DBQ attempt was disappointing relative to her other work. She summarized the documents well but didn't build an argument. This is a common freshman issue. What concerns me is she seemed to shut down afterward — very hard on herself. I need to frame the feedback carefully. The skill is teachable; the self-criticism worries me more.""" .

<#note-rodriguez-oct>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Ms. Rodriguez (English / Homeroom)" ;
  edu:date "2024-10-30"^^xsd:date ;
  edu:category "Behavioral" ;
  edu:content """Noticed Emma has been quieter than usual in homeroom this month. Had a brief check-in — she mentioned feeling stressed about history class. Also mentioned she didn't use the extended time on her persuasive essay even though she could have used it. When I asked why, she said she 'didn't want to be different.' Connected her with Mr. Okafor for extra support and flagged the accommodation concern for Dr. Kim.""" .

<#note-gutierrez-oct>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Sra. Gutierrez (Spanish)" ;
  edu:date "2024-10-28"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma works hard in Spanish and her pronunciation is quite good — I suspect she watches Spanish-language media. She's a bit hesitant to speak up in class but does well in small group and paired activities. Her written work is stronger than her oral performance, which is the opposite of many students.""" .

# ── November ─────────────────────────────────────────────────────────

<#note-thompson-nov>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Thompson (Mathematics)" ;
  edu:date "2024-11-20"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma continues to be one of the strongest students in Algebra I. She often helps peers during group work without being asked. I'd like to recommend her for the spring Math Olympiad team and for Honors Geometry. Her only weakness is rushing through word problems — when she slows down, she gets them right every time. I suspect it's the time-pressure anxiety from her IEP profile. Going to talk to her about using her extended time more on tests.""" .

<#note-patel-nov>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Dr. Patel (Biology)" ;
  edu:date "2024-11-08"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's photosynthesis lab report was exemplary. She was the only student to include a proper error analysis section without being asked. I've asked her to present her methodology to the class next week. She initially seemed nervous but agreed. She has real aptitude for scientific writing — the structured format seems to suit her. Her lab partner (Aisha) and she make a great team.""" .

<#note-liu-nov>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Liu (Computer Science)" ;
  edu:date "2024-11-15"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma picked up Python remarkably fast. She's already helping classmates debug their code during lab time. The text adventure game she's building for Project 2 is very ambitious — save/load system, ASCII art, inventory. She told me she's been coding at home every evening. I'd recommend AP CS Principles for her in spring. Also suggested she check out the Robotics Club.""" .

<#note-counselor-nov>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Dr. Kim (School Counselor)" ;
  edu:date "2024-11-25"^^xsd:date ;
  edu:category "Social-Emotional" ;
  edu:content """Routine IEP check-in. Emma is adjusting well to high school overall. Has a solid friend group forming — Aisha Johnson, Jayden Martinez, Sophie Park. She's considering joining the Robotics Club in spring (Mr. Liu's suggestion). Discussed the accommodation issue — she admits she sometimes avoids using extended time because she doesn't want classmates to notice. We practiced a script for requesting it naturally. She's getting better. Also discussed test anxiety — she tends to rush when nervous. Will revisit strategies in January.""" .

<#note-davis-nov>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Coach Davis (PE)" ;
  edu:date "2024-11-12"^^xsd:date ;
  edu:category "General" ;
  edu:content """Emma is a steady participant in PE. Not an athlete, but gives good effort and is a positive teammate. She seems to especially enjoy the badminton unit — asked if we'd have it again in spring. No concerns.""" .

# ── December ─────────────────────────────────────────────────────────

<#note-okafor-dec>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Okafor (World History)" ;
  edu:date "2024-12-05"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Since starting office hours in November, Emma has improved noticeably. Her latest DBQ practice essay scored 8/10 (up from 5/10 in October). She's engaging more with primary sources and asking thoughtful questions. The graphic organizer accommodation is helping enormously with her essay structure. She also took a leadership role in the China group project and organized the team effectively. Confident she'll finish the semester with a B. Very proud of her progress.""" .

<#note-rodriguez-dec>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Ms. Rodriguez (English / Homeroom)" ;
  edu:date "2024-12-15"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's final essay on To Kill a Mockingbird was her best work this semester — clear improvement in transitions and conclusion. She told me she used the graphic organizer I gave her AND took the extended time. That's a big step. She's also been more social in homeroom this month — I overheard her animatedly discussing a coding project with Jayden. She seems happier and more confident than in October.""" .

<#note-liu-dec>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Liu (Computer Science)" ;
  edu:date "2024-12-12"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's final project was the best in the class by a significant margin. Her text adventure game had features I hadn't even suggested — a map system, random events, inventory puzzles. Code was well-organized with functions, clear variable names, and helpful comments. She's registered for AP CS Principles and has already started attending Robotics Club meetings. I think CS might be her thing.""" .

<#note-counselor-dec>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Dr. Kim (School Counselor)" ;
  edu:date "2024-12-18"^^xsd:date ;
  edu:category "Social-Emotional" ;
  edu:content """End-of-semester check-in. Emma had a strong second half of the semester after a rocky October. Key positives: (1) history grades recovered dramatically with office hours and graphic organizer, (2) she used her extended time accommodation voluntarily on the last two assessments, (3) friend group is solid, (4) Robotics Club gives her a new community. Concerns to monitor in spring: (1) test anxiety — less acute but still present, (2) tendency toward perfectionism — she still gets upset about B+ grades. Recommended continuing monthly check-ins. Parents (met with Li Chen at conference) are very supportive and grateful for the progress.""" .

# ── January ──────────────────────────────────────────────────────────

<#note-thompson-jan>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Mr. Thompson (Mathematics)" ;
  edu:date "2025-01-12"^^xsd:date ;
  edu:category "Academic" ;
  edu:content """Emma's final exam: A- (90/100). She used her extended time and it showed — her word problem answers were much more careful. Semester grade: A-. I've officially recommended her for Honors Geometry in spring. She earned it. Also putting her name forward for Math Olympiad team tryouts.""" .

<#note-parent-conference>
  a edu:TeacherNote ;
  edu:student <profile#me> ;
  edu:author "Ms. Rodriguez (Homeroom Advisor)" ;
  edu:date "2025-01-15"^^xsd:date ;
  edu:category "Parent Conference" ;
  edu:content """Met with Li and David Chen for semester review. Overall very positive. Shared Emma's growth across the semester — the improvement in history and writing, the CS aptitude, the progress with accommodations. Parents are thrilled about Honors Geometry recommendation. Li asked about the test anxiety — we discussed strategies for home (reducing perfectionist language, praising effort over outcomes). David mentioned Emma has been coding at home most evenings and he's been learning Python alongside her. Lovely family. Spring plan: continue IEP accommodations, Honors Geometry, AP CS Principles, continue monthly check-ins.""" .
`;

const attendance = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#attendance-fall-2024>
  a edu:AttendanceRecord ;
  edu:student <profile#me> ;
  edu:term "Fall 2024" ;
  edu:totalDays 88 ;
  edu:daysPresent 84 ;
  edu:daysAbsent 4 ;
  edu:daysExcused 3 ;
  edu:daysUnexcused 1 ;
  edu:tardies 5 ;
  edu:attendanceRate "95.5" .

<#absence-1>
  a edu:Absence ;
  edu:student <profile#me> ;
  edu:date "2024-09-23"^^xsd:date ;
  edu:type "Excused" ;
  edu:reason "Medical appointment — dentist" ;
  edu:parentNotified true .

<#absence-2>
  a edu:Absence ;
  edu:student <profile#me> ;
  edu:date "2024-10-14"^^xsd:date ;
  edu:type "Excused" ;
  edu:reason "Family emergency — grandmother hospitalized (recovered)" ;
  edu:parentNotified true ;
  edu:followUp "Dr. Kim checked in with Emma on 10/15. She was a bit shaken but okay." .

<#absence-3>
  a edu:Absence ;
  edu:student <profile#me> ;
  edu:date "2024-11-01"^^xsd:date ;
  edu:type "Unexcused" ;
  edu:reason "No reason provided by parent" ;
  edu:parentNotified true ;
  edu:followUp "Li Chen called back — Emma had a migraine but forgot to send the note. Reclassification to excused pending doctor note." .

<#absence-4>
  a edu:Absence ;
  edu:student <profile#me> ;
  edu:date "2024-12-09"^^xsd:date ;
  edu:type "Excused" ;
  edu:reason "Illness — stomach flu" ;
  edu:parentNotified true ;
  edu:followUp "Returned 12/10. Teachers provided make-up work." .

<#tardy-1>
  a edu:Tardy ;
  edu:student <profile#me> ;
  edu:date "2024-09-11"^^xsd:date ;
  edu:minutesLate 8 ;
  edu:period 1 ;
  edu:reason "Bus Route 12 ran late — affected 6 students" .

<#tardy-2>
  a edu:Tardy ;
  edu:student <profile#me> ;
  edu:date "2024-10-02"^^xsd:date ;
  edu:minutesLate 5 ;
  edu:period 1 ;
  edu:reason "Bus Route 12 ran late" .

<#tardy-3>
  a edu:Tardy ;
  edu:student <profile#me> ;
  edu:date "2024-10-29"^^xsd:date ;
  edu:minutesLate 3 ;
  edu:period 5 ;
  edu:reason "Stayed late talking with Mr. Okafor after history — lost track of time" .

<#tardy-4>
  a edu:Tardy ;
  edu:student <profile#me> ;
  edu:date "2024-11-14"^^xsd:date ;
  edu:minutesLate 4 ;
  edu:period 1 ;
  edu:reason "Bus Route 12 ran late" .

<#tardy-5>
  a edu:Tardy ;
  edu:student <profile#me> ;
  edu:date "2024-12-11"^^xsd:date ;
  edu:minutesLate 2 ;
  edu:period 6 ;
  edu:reason "Ran back to locker for laptop charger" .
`;

const extracurriculars = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#robotics-club>
  a edu:ExtracurricularActivity ;
  edu:student <profile#me> ;
  edu:activityName "Westfield Robotics Club" ;
  edu:type "STEM Club" ;
  edu:advisor "Mr. Liu" ;
  edu:startDate "2024-11-18"^^xsd:date ;
  edu:schedule "Mondays & Wednesdays 3:00-4:30 PM" ;
  edu:role "Member (Freshman)" ;
  edu:status "Active" ;
  edu:notes "Joined mid-semester on Mr. Liu's recommendation. Working on the programming sub-team for the FRC robot. Learning Java for the robot controller. Already contributing to the autonomous navigation code." .

<#writing-workshop>
  a edu:ExtracurricularActivity ;
  edu:student <profile#me> ;
  edu:activityName "After-School Writing Workshop" ;
  edu:type "Academic Support" ;
  edu:advisor "Ms. Rodriguez" ;
  edu:startDate "2024-10-01"^^xsd:date ;
  edu:endDate "2024-12-17"^^xsd:date ;
  edu:schedule "Tuesdays 3:00-4:00 PM" ;
  edu:role "Participant" ;
  edu:status "Completed" ;
  edu:notes "Part of Emma's learning plan to improve essay structure. Attended every session. Made significant progress with paragraph transitions. Plans to continue in spring if offered." .

<#math-olympiad>
  a edu:ExtracurricularActivity ;
  edu:student <profile#me> ;
  edu:activityName "Math Olympiad Team" ;
  edu:type "Academic Competition" ;
  edu:advisor "Mr. Thompson" ;
  edu:startDate "2025-01-20"^^xsd:date ;
  edu:schedule "Thursdays 3:00-4:30 PM" ;
  edu:role "Team Member" ;
  edu:status "Upcoming" ;
  edu:notes "Recommended by Mr. Thompson after strong Algebra I performance. Tryouts in late January. Emma expressed interest but also nervousness about competitions." .

<#library-volunteer>
  a edu:ExtracurricularActivity ;
  edu:student <profile#me> ;
  edu:activityName "School Library Student Volunteer" ;
  edu:type "Service" ;
  edu:advisor "Ms. Park (Librarian)" ;
  edu:startDate "2024-09-15"^^xsd:date ;
  edu:schedule "Fridays during lunch (occasional)" ;
  edu:role "Volunteer Shelver" ;
  edu:status "Active" ;
  edu:notes "Emma volunteers to help shelve books during Friday lunch when she doesn't have other plans. Ms. Park says she's reliable and has good book recommendations for other students." .

<#summer-camp-2024>
  a edu:ExtracurricularActivity ;
  edu:student <profile#me> ;
  edu:activityName "Girls Who Code — Summer Immersion Program" ;
  edu:type "Summer Program" ;
  edu:advisor "External — Girls Who Code" ;
  edu:startDate "2024-06-17"^^xsd:date ;
  edu:endDate "2024-08-09"^^xsd:date ;
  edu:schedule "Mon-Fri 9:00 AM - 3:00 PM (8 weeks)" ;
  edu:role "Participant" ;
  edu:status "Completed" ;
  edu:notes "This is where Emma first learned to code. Built a final project analyzing local air quality data with Python. The experience is what led her to enroll in Mr. Liu's CS class. Strong recommendation letter on file from program instructor." .
`;

const reportCards = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#report-card-fall-2024>
  a edu:ReportCard ;
  edu:student <profile#me> ;
  edu:term "Fall 2024" ;
  edu:issueDate "2025-01-17"^^xsd:date ;
  edu:gpa "3.62" ;
  edu:weightedGpa "3.62" ;
  edu:credits 7.0 ;
  edu:classRank "47 of 312" ;
  edu:advisorComment """Emma had an excellent first semester of high school. She demonstrated strong growth in areas that challenged her early on, particularly in World History and essay writing. Her work in math, science, and computer science has been consistently strong. I'm especially proud of her progress in using her IEP accommodations — this is a skill that will serve her throughout her academic career. Emma is a thoughtful, hardworking student with a bright future. — Ms. Rodriguez""" .

<#grade-math>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "Algebra I" ;
  edu:courseCode "MATH-1010" ;
  edu:instructor "Mr. Thompson" ;
  edu:letterGrade "A-" ;
  edu:percentGrade 91 ;
  edu:credits 1.0 ;
  edu:comment "Excellent work. Recommended for Honors Geometry." .

<#grade-ela>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "English Language Arts 9" ;
  edu:courseCode "ELA-0900" ;
  edu:instructor "Ms. Rodriguez" ;
  edu:letterGrade "B+" ;
  edu:percentGrade 88 ;
  edu:credits 1.0 ;
  edu:comment "Strong growth in essay structure. Voice is developing nicely." .

<#grade-bio>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "Biology" ;
  edu:courseCode "SCI-1010" ;
  edu:instructor "Dr. Patel" ;
  edu:letterGrade "A" ;
  edu:percentGrade 93 ;
  edu:credits 1.0 ;
  edu:comment "Excellent lab work and scientific reasoning. A pleasure to teach." .

<#grade-history>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "World History" ;
  edu:courseCode "HIST-1010" ;
  edu:instructor "Mr. Okafor" ;
  edu:letterGrade "B" ;
  edu:percentGrade 83 ;
  edu:credits 1.0 ;
  edu:comment "Remarkable improvement in the second half. DBQ skills developing well." .

<#grade-spanish>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "Spanish II" ;
  edu:courseCode "LANG-2020" ;
  edu:instructor "Sra. Gutierrez" ;
  edu:letterGrade "B+" ;
  edu:percentGrade 86 ;
  edu:credits 1.0 ;
  edu:comment "Good effort and improving oral confidence." .

<#grade-cs>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "Intro to Computer Science" ;
  edu:courseCode "CS-1010" ;
  edu:instructor "Mr. Liu" ;
  edu:letterGrade "A+" ;
  edu:percentGrade 98 ;
  edu:credits 0.5 ;
  edu:comment "Outstanding. Best student in the class. Registered for AP CS Principles." .

<#grade-pe>
  a edu:CourseGrade ;
  edu:reportCard <#report-card-fall-2024> ;
  edu:courseName "Physical Education" ;
  edu:courseCode "PE-0900" ;
  edu:instructor "Coach Davis" ;
  edu:letterGrade "B" ;
  edu:percentGrade 84 ;
  edu:credits 0.5 ;
  edu:comment "Good effort and sportsmanship. Enjoys badminton." .

# ── Middle School Transcript Summary ─────────────────────────────────

<#transcript-8th-grade>
  a edu:ReportCard ;
  edu:student <profile#me> ;
  edu:term "8th Grade — Full Year (2023-2024)" ;
  edu:issueDate "2024-06-14"^^xsd:date ;
  edu:gpa "3.70" ;
  edu:credits 8.0 ;
  edu:advisorComment """Emma is a dedicated student who works hard and cares about her learning. She particularly excelled in math and science this year. Her written expression continues to be an area where she needs support, but she's developing good strategies. We're confident she's ready for high school. — Mr. Nakamura, 8th Grade Advisor""" .
`;

const disciplinary = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#record-summary>
  a edu:DisciplinaryRecord ;
  edu:student <profile#me> ;
  edu:term "Fall 2024" ;
  edu:totalIncidents 1 ;
  edu:suspensions 0 ;
  edu:detentions 0 ;
  edu:overallStatus "Good Standing" .

<#incident-1>
  a edu:DisciplinaryIncident ;
  edu:student <profile#me> ;
  edu:date "2024-10-17"^^xsd:date ;
  edu:type "Minor — Cell Phone Violation" ;
  edu:description "Phone confiscated during Biology class. Was texting under the desk during a lab demonstration." ;
  edu:reportedBy "Dr. Patel" ;
  edu:action "Verbal warning. Phone returned at end of day." ;
  edu:parentNotified false ;
  edu:followUp "Emma apologized. No repeat incidents. Dr. Patel noted it was out of character." .
`;

const healthWellness = `@prefix edu: <http://example.org/education#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#health-record>
  a edu:HealthRecord ;
  edu:student <profile#me> ;
  edu:lastPhysical "2024-08-01"^^xsd:date ;
  edu:physicalStatus "Cleared for all activities" ;
  edu:vision "20/25 — corrective lenses (glasses)" ;
  edu:hearing "Normal" ;
  edu:allergies "None reported" ;
  edu:medications "None" ;
  edu:immunizationsUpToDate true .

<#wellness-screening-fall>
  a edu:WellnessScreening ;
  edu:student <profile#me> ;
  edu:date "2024-10-05"^^xsd:date ;
  edu:type "Social-Emotional Wellness Screening (universal)" ;
  edu:screener "School Nurse — Ms. Johansson" ;
  edu:result "Some Concerns" ;
  edu:notes """Emma scored in the 'some concerns' range for anxiety on the PHQ-A screening tool. She reported occasional worry about school performance and difficulty sleeping before tests. Referred to Dr. Kim for follow-up. Not at clinical threshold — monitoring recommended.""" ;
  edu:followUp "Dr. Kim conducted follow-up on 2024-10-12. Consistent with known test anxiety. IEP accommodations and counseling check-ins are appropriate supports. No clinical referral needed at this time." .

<#nurse-visit-1>
  a edu:NurseVisit ;
  edu:student <profile#me> ;
  edu:date "2024-11-14"^^xsd:date ;
  edu:reason "Headache and stomachache before period 4 (History midterm)" ;
  edu:action "Rested in nurse's office for 15 minutes. Drank water. Reported feeling better." ;
  edu:notes "Likely test-anxiety related — History midterm was that period. Emma recognized the pattern herself and said 'I think I'm just nervous.' Encouraged her to use the breathing exercises from Dr. Kim." ;
  edu:returnedToClass true .

<#nurse-visit-2>
  a edu:NurseVisit ;
  edu:student <profile#me> ;
  edu:date "2024-12-09"^^xsd:date ;
  edu:reason "Stomach flu symptoms — nausea, low fever (99.8F)" ;
  edu:action "Parent contacted. Li Chen picked up at 10:30 AM." ;
  edu:notes "Genuine illness, not anxiety. Several students out with the same bug this week." ;
  edu:returnedToClass false .
`;

// ---------------------------------------------------------------------------
// Files to upload
// ---------------------------------------------------------------------------

const files: [string, string][] = [
  ["profile.ttl", profile],
  ["schedule.ttl", schedule],
  ["test-scores.ttl", testScores],
  ["learning-plan.ttl", learningPlan],
  ["teacher-notes.ttl", teacherNotes],
  ["attendance.ttl", attendance],
  ["extracurriculars.ttl", extracurriculars],
  ["report-cards.ttl", reportCards],
  ["disciplinary.ttl", disciplinary],
  ["health-wellness.ttl", healthWellness],
];

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

async function putTurtle(
  url: string,
  body: string,
  authFetch: typeof fetch
): Promise<void> {
  const res = await authFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${url} failed: ${res.status} ${res.statusText}\n${text}`);
  }
}

async function ensureContainer(
  url: string,
  authFetch: typeof fetch
): Promise<void> {
  const res = await authFetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "text/turtle",
      Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
      "If-None-Match": "*",
    },
    body: "",
  });
  // 412 means it already exists — that's fine
  if (!res.ok && res.status !== 412) {
    const text = await res.text();
    throw new Error(
      `Create container ${url} failed: ${res.status} ${res.statusText}\n${text}`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const clientId = process.env.SOLID_CLIENT_ID;
  const clientSecret = process.env.SOLID_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Missing SOLID_CLIENT_ID or SOLID_CLIENT_SECRET.\n" +
        "Set them in .env and run with: npx tsx --env-file=.env scripts/seed-education-data.ts"
    );
    process.exit(1);
  }

  // 1. Authenticate
  console.log("Authenticating with client credentials...");
  const session = new Session();
  await session.login({
    oidcIssuer: OIDC_ISSUER,
    clientId,
    clientSecret,
    tokenType: "Bearer",
  });

  if (!session.info.isLoggedIn || !session.info.webId) {
    console.error("Authentication failed. Check your client ID and secret.");
    process.exit(1);
  }
  console.log(`Authenticated as ${session.info.webId}`);

  // 2. Discover pod URL
  const podUrls = await getPodUrlAll(session.info.webId, {
    fetch: session.fetch,
  });
  if (podUrls.length === 0) {
    console.error("No pod found for this WebID.");
    await session.logout();
    process.exit(1);
  }
  const podUrl = podUrls[0];
  console.log(`Pod URL: ${podUrl}`);

  // 3. Create education container
  const educationUrl = `${podUrl}education/`;
  console.log(`\nCreating education container: ${educationUrl}`);
  await ensureContainer(educationUrl, session.fetch);

  // 4. Upload all files
  for (const [filename, content] of files) {
    const fileUrl = `${educationUrl}${filename}`;
    process.stdout.write(`  ${filename}... `);
    await putTurtle(fileUrl, content, session.fetch);
    console.log("ok");
  }

  console.log(`\nDone! Education data seeded at:\n  ${educationUrl}`);
  console.log("\nContents:");
  console.log("  education/");
  for (const [filename] of files) {
    console.log(`    ${filename}`);
  }

  await session.logout();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
