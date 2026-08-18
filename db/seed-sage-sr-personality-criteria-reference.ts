import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { sageSrPersonalityCriteriaReference } from "./schema"

config({ path: ".env.local" })

// Source: manual mapping of every SAGE-SR Personality item (Response Report, not just what
// TeleSage's own diagnostic report chooses to display) against DSM-5-TR personality disorder
// criteria, built from the real Test01 item bank, reviewed by Ben, delivered as
// dsm5tr-personality-criterion-mapping.xlsx. Criteria are paraphrased in our own words, not
// quoted from the DSM-5-TR text.
//
// Deliberately excluded from this seed data:
//  - Criteria with no corresponding SAGE-SR item at all (e.g. Schizoid criterion 6
//    "indifferent to praise/criticism", Schizotypal criterion 9 "excessive social anxiety
//    with paranoid quality") — simply absent from this table for that disorder.
//  - Obsessive-Compulsive criteria 4 and 7 — the real Test01 responses for the mapped items
//    ("I had very high ethical standards...": Rarely; "I liked spending money on myself and
//    other people": Often) didn't clearly fit either scoring direction. Left out rather than
//    guessed at; revisit once Ben has a clinical read on these two.
//
// Some items are mapped under more than one disorder (noted inline) where DSM-5-TR criteria
// genuinely overlap across disorders (e.g. lack of close friends appears in both Schizoid and
// Schizotypal) or where TeleSage's own report displays one item under a different trait's box
// than where it also legitimately applies.
const UNSURFACED_NOTE = "From the Response Report; not shown in TeleSage's own diagnostic display for this trait."

interface CriterionRow {
  disorder: string
  criterionNumber: number
  criterionText: string
  threshold: number
  total: number
  itemText: string
  reverseScored?: boolean
  notes?: string
}

const ROWS: CriterionRow[] = [
  // ---------- Paranoid Personality Disorder (≥4 of 7) ----------
  { disorder: "Paranoid Personality Disorder", criterionNumber: 1, criterionText: "Suspects, without adequate basis, that others are exploiting, harming, or deceiving them.", threshold: 4, total: 7, itemText: "People tried to hurt, deceive, or take advantage of me." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 2, criterionText: "Preoccupied with unjustified doubts about the loyalty or trustworthiness of friends or associates.", threshold: 4, total: 7, itemText: "I spent a lot of time thinking about whether I could trust my friends or colleagues." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 3, criterionText: "Reluctant to confide in others due to unwarranted fear that information will be used against them.", threshold: 4, total: 7, itemText: "I kept personal information to myself because I was afraid even my friends might use it against me." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 4, criterionText: "Reads hidden demeaning or threatening meanings into benign remarks or events.", threshold: 4, total: 7, itemText: "I knew that things people said were really meant to threaten or insult me, even though other people were unaware of it." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 5, criterionText: "Persistently bears grudges (unforgiving of insults, injuries, or slights).", threshold: 4, total: 7, itemText: "I forgave people who insulted or injured me.", reverseScored: true },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 5, criterionText: "Persistently bears grudges (unforgiving of insults, injuries, or slights).", threshold: 4, total: 7, itemText: "I held grudges against many people." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 6, criterionText: "Perceives attacks on their character or reputation not apparent to others, and reacts angrily or counterattacks quickly.", threshold: 4, total: 7, itemText: "I became enraged when someone insulted or said bad things about me." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 6, criterionText: "Perceives attacks on their character or reputation not apparent to others, and reacts angrily or counterattacks quickly.", threshold: 4, total: 7, itemText: "People said I overreacted when someone offended me." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 7, criterionText: "Has recurrent, unjustified suspicions about the fidelity of a spouse or partner.", threshold: 4, total: 7, itemText: "I suspected that my romantic partner was unfaithful to me." },
  { disorder: "Paranoid Personality Disorder", criterionNumber: 7, criterionText: "Has recurrent, unjustified suspicions about the fidelity of a spouse or partner.", threshold: 4, total: 7, itemText: "I did things to find out if my romantic partner was cheating on me." },

  // ---------- Schizoid Personality Disorder (≥4 of 7) ----------
  { disorder: "Schizoid Personality Disorder", criterionNumber: 1, criterionText: "Neither desires nor enjoys close relationships, including being part of a family.", threshold: 4, total: 7, itemText: "I enjoyed being with a good friend or family member.", reverseScored: true },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 1, criterionText: "Neither desires nor enjoys close relationships, including being part of a family.", threshold: 4, total: 7, itemText: "Having a close relationship with a friend or family member was important to me.", reverseScored: true },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 2, criterionText: "Almost always chooses solitary activities.", threshold: 4, total: 7, itemText: "I preferred doing things alone rather than with other people.", notes: UNSURFACED_NOTE },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 3, criterionText: "Has little or no interest in sexual experiences with another person.", threshold: 4, total: 7, itemText: "I wanted to have a sexual experience with someone.", reverseScored: true, notes: UNSURFACED_NOTE },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 4, criterionText: "Takes pleasure in few, if any, activities.", threshold: 4, total: 7, itemText: "There were very few activities I enjoyed." },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 5, criterionText: "Lacks close friends or confidants other than first-degree relatives.", threshold: 4, total: 7, itemText: "I had a friend, other than a family member, with whom I could discuss personal thoughts or private information.", reverseScored: true },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 7, criterionText: "Shows emotional coldness, detachment, or flattened affect.", threshold: 4, total: 7, itemText: "People might have thought I lacked feelings or that I was unemotional." },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 7, criterionText: "Shows emotional coldness, detachment, or flattened affect.", threshold: 4, total: 7, itemText: "I laughed aloud or cried.", reverseScored: true },
  { disorder: "Schizoid Personality Disorder", criterionNumber: 7, criterionText: "Shows emotional coldness, detachment, or flattened affect.", threshold: 4, total: 7, itemText: "I experienced strong emotions, such as anger, joy, or excitement.", reverseScored: true },
  // criterion 6 ("appears indifferent to praise or criticism") has no corresponding SAGE-SR item — intentionally absent

  // ---------- Schizotypal Personality Disorder (≥5 of 9) ----------
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 1, criterionText: "Ideas of reference (excluding frank delusions of reference).", threshold: 5, total: 9, itemText: "I thought the people in movies or on TV shows might be talking specifically about me." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 1, criterionText: "Ideas of reference (excluding frank delusions of reference).", threshold: 5, total: 9, itemText: "I thought strangers were talking about me." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 1, criterionText: "Ideas of reference (excluding frank delusions of reference).", threshold: 5, total: 9, itemText: "I thought the words in a song were specifically intended for me." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 2, criterionText: "Odd beliefs or magical thinking that influences behavior (e.g. superstitiousness, belief in telepathy or a “sixth sense”), inconsistent with subcultural norms.", threshold: 5, total: 9, itemText: "I believed I had the ability to make something happen just by thinking about it." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 2, criterionText: "Odd beliefs or magical thinking that influences behavior (e.g. superstitiousness, belief in telepathy or a “sixth sense”), inconsistent with subcultural norms.", threshold: 5, total: 9, itemText: "I believed I had the unusual ability to predict the future." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 2, criterionText: "Odd beliefs or magical thinking that influences behavior (e.g. superstitiousness, belief in telepathy or a “sixth sense”), inconsistent with subcultural norms.", threshold: 5, total: 9, itemText: "I believed I had the actual ability to read other people's minds.", notes: UNSURFACED_NOTE },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 3, criterionText: "Unusual perceptual experiences, including bodily illusions.", threshold: 5, total: 9, itemText: "I felt strange sensations on or under my skin that I could not explain." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 3, criterionText: "Unusual perceptual experiences, including bodily illusions.", threshold: 5, total: 9, itemText: "I felt I was outside my body observing myself." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 3, criterionText: "Unusual perceptual experiences, including bodily illusions.", threshold: 5, total: 9, itemText: "I had the very strange sense that there was a person or presence around me even though no one was there." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 3, criterionText: "Unusual perceptual experiences, including bodily illusions.", threshold: 5, total: 9, itemText: "I heard a voice but could not tell if it was real." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 4, criterionText: "Odd thinking and speech (e.g. vague, circumstantial, metaphorical, overelaborate, or stereotyped).", threshold: 5, total: 9, itemText: "People might have thought I explained simple things in confusing ways.", notes: UNSURFACED_NOTE },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 4, criterionText: "Odd thinking and speech (e.g. vague, circumstantial, metaphorical, overelaborate, or stereotyped).", threshold: 5, total: 9, itemText: "People complained that when I was talking, I wandered from topic to topic.", notes: UNSURFACED_NOTE },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 4, criterionText: "Odd thinking and speech (e.g. vague, circumstantial, metaphorical, overelaborate, or stereotyped).", threshold: 5, total: 9, itemText: "People complained that when I was talking, it took me too long to get to the point.", notes: UNSURFACED_NOTE },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 5, criterionText: "Suspiciousness or paranoid ideation.", threshold: 5, total: 9, itemText: "I was suspicious of other people because I thought they might be trying to harm or take advantage of me." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 6, criterionText: "Inappropriate or constricted affect.", threshold: 5, total: 9, itemText: "I experienced strong emotions, such as anger, joy, or excitement.", reverseScored: true },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 7, criterionText: "Behavior or appearance that is odd, eccentric, or peculiar.", threshold: 5, total: 9, itemText: "People might have thought I looked strange, odd, or weird." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 7, criterionText: "Behavior or appearance that is odd, eccentric, or peculiar.", threshold: 5, total: 9, itemText: "People might have thought that my behavior was strange, odd, or weird." },
  { disorder: "Schizotypal Personality Disorder", criterionNumber: 8, criterionText: "Lack of close friends or confidants other than first-degree relatives.", threshold: 5, total: 9, itemText: "I had a friend, other than a family member, with whom I could discuss personal thoughts or private information.", reverseScored: true, notes: "Same item also mapped under Schizoid criterion 5 — DSM-5-TR criteria for schizoid-spectrum disorders legitimately overlap." },
  // criterion 9 ("excessive social anxiety with paranoid quality") has no corresponding SAGE-SR item — intentionally absent

  // ---------- Antisocial Personality Disorder (≥3 of 7 adult-pattern criteria; Conduct Disorder before age 15 not scoreable from this instrument) ----------
  { disorder: "Antisocial Personality Disorder", criterionNumber: 1, criterionText: "Failure to conform to social norms regarding lawful behavior, as indicated by repeatedly performing acts that are grounds for arrest.", threshold: 3, total: 7, itemText: "I did something for which I could easily be arrested." },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 2, criterionText: "Deceitfulness — repeated lying, use of aliases, or conning others for personal profit or pleasure.", threshold: 3, total: 7, itemText: "I told a big lie to get something I wanted.", notes: UNSURFACED_NOTE },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 3, criterionText: "Impulsivity or failure to plan ahead.", threshold: 3, total: 7, itemText: "I did something that could have harmed someone without thinking about the consequences." },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 4, criterionText: "Irritability and aggressiveness, as indicated by repeated physical fights or assaults.", threshold: 3, total: 7, itemText: "I was so angry I broke something or hit someone.", notes: "Same item also mapped under Borderline criterion 8 — shared across trait boxes in TeleSage's own display." },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 5, criterionText: "Reckless disregard for the safety of self or others.", threshold: 3, total: 7, itemText: "I did something that others might have thought was reckless, such as driving while impaired or having unsafe sex with someone I just met." },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 6, criterionText: "Consistent irresponsibility, as indicated by repeated failure to sustain work behavior or honor financial obligations.", threshold: 3, total: 7, itemText: "I cared about paying my bills on time.", reverseScored: true },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 7, criterionText: "Lack of remorse, as indicated by being indifferent to or rationalizing having hurt, mistreated, or stolen from another.", threshold: 3, total: 7, itemText: "I felt justified when I hurt or stole from someone." },
  { disorder: "Antisocial Personality Disorder", criterionNumber: 7, criterionText: "Lack of remorse, as indicated by being indifferent to or rationalizing having hurt, mistreated, or stolen from another.", threshold: 3, total: 7, itemText: "I felt badly about having hurt or stolen from someone.", reverseScored: true, notes: UNSURFACED_NOTE },

  // ---------- Borderline Personality Disorder (≥5 of 9) ----------
  { disorder: "Borderline Personality Disorder", criterionNumber: 1, criterionText: "Frantic efforts to avoid real or imagined abandonment.", threshold: 5, total: 9, itemText: "I worried a lot about being left alone to take care of myself.", notes: "Same item also mapped under Dependent criterion 8 — shared across trait boxes in TeleSage's own display." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 1, criterionText: "Frantic efforts to avoid real or imagined abandonment.", threshold: 5, total: 9, itemText: "If a close relationship had ended, I would have done everything I could to find someone to support or care for me.", notes: "Same item also mapped under Dependent criterion 7 — shared across trait boxes in TeleSage's own display." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 2, criterionText: "A pattern of unstable and intense interpersonal relationships characterized by alternating between idealization and devaluation.", threshold: 5, total: 9, itemText: "I alternated between thinking people I care about were either perfect or very flawed." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 3, criterionText: "Identity disturbance — markedly and persistently unstable self-image or sense of self.", threshold: 5, total: 9, itemText: "I made a sudden change in how I think about who I am, such as my goals, religious beliefs, sexual orientation, or gender identity." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I impulsively had unsafe sex." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I drove a car recklessly." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I impulsively used drugs or alcohol." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I impulsively did something (else) that was self-destructive." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I impulsively spent too much money.", notes: UNSURFACED_NOTE },
  { disorder: "Borderline Personality Disorder", criterionNumber: 4, criterionText: "Impulsivity in at least two potentially self-damaging areas (e.g. spending, sex, substance use, reckless driving, binge eating).", threshold: 5, total: 9, itemText: "I impulsively binged on food.", notes: UNSURFACED_NOTE },
  { disorder: "Borderline Personality Disorder", criterionNumber: 5, criterionText: "Recurrent suicidal behavior, gestures, or threats, or self-mutilating behavior.", threshold: 5, total: 9, itemText: "I threatened to kill myself." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 5, criterionText: "Recurrent suicidal behavior, gestures, or threats, or self-mutilating behavior.", threshold: 5, total: 9, itemText: "I tried to kill myself." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 5, criterionText: "Recurrent suicidal behavior, gestures, or threats, or self-mutilating behavior.", threshold: 5, total: 9, itemText: "I did things on purpose to injure myself, such as cutting or burning my skin." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 6, criterionText: "Affective instability due to marked reactivity of mood.", threshold: 5, total: 9, itemText: "Things that happened around me caused a big change in my mood.", notes: UNSURFACED_NOTE },
  { disorder: "Borderline Personality Disorder", criterionNumber: 7, criterionText: "Chronic feelings of emptiness.", threshold: 5, total: 9, itemText: "I felt empty inside.", notes: UNSURFACED_NOTE },
  { disorder: "Borderline Personality Disorder", criterionNumber: 8, criterionText: "Inappropriate, intense anger or difficulty controlling anger.", threshold: 5, total: 9, itemText: "I had difficulty controlling my anger." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 8, criterionText: "Inappropriate, intense anger or difficulty controlling anger.", threshold: 5, total: 9, itemText: "I was so angry I broke something or hit someone.", notes: "Same item also mapped under Antisocial criterion 4." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 9, criterionText: "Transient, stress-related paranoid ideation or severe dissociative symptoms.", threshold: 5, total: 9, itemText: "When I felt stressed, I became unsure of what was real." },
  { disorder: "Borderline Personality Disorder", criterionNumber: 9, criterionText: "Transient, stress-related paranoid ideation or severe dissociative symptoms.", threshold: 5, total: 9, itemText: "In stressful situations, I became suspicious of other people." },

  // ---------- Histrionic Personality Disorder (≥5 of 8) ----------
  { disorder: "Histrionic Personality Disorder", criterionNumber: 1, criterionText: "Uncomfortable in situations in which they are not the center of attention.", threshold: 5, total: 8, itemText: "I felt uncomfortable in situations where someone else was the center of attention." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 2, criterionText: "Interaction with others often characterized by inappropriately sexually seductive or provocative behavior.", threshold: 5, total: 8, itemText: "I upset people because I flirted too much." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 3, criterionText: "Displays rapidly shifting and shallow expression of emotions.", threshold: 5, total: 8, itemText: "The emotions I expressed changed quickly many times a day." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 4, criterionText: "Consistently uses physical appearance to draw attention to self.", threshold: 5, total: 8, itemText: "I used my physical appearance to make me the center of attention." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 4, criterionText: "Consistently uses physical appearance to draw attention to self.", threshold: 5, total: 8, itemText: "It was very important to me to change my appearance to keep up with current fads and trends." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 5, criterionText: "Style of speech that is excessively impressionistic and lacking in detail.", threshold: 5, total: 8, itemText: "When telling people about events, I cared more about telling a good story than the accuracy of the details." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 5, criterionText: "Style of speech that is excessively impressionistic and lacking in detail.", threshold: 5, total: 8, itemText: "I expressed my opinions without having much evidence to support them." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 6, criterionText: "Shows self-dramatization, theatricality, and exaggerated expression of emotion.", threshold: 5, total: 8, itemText: "People might have thought I was being too dramatic." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 6, criterionText: "Shows self-dramatization, theatricality, and exaggerated expression of emotion.", threshold: 5, total: 8, itemText: "I expressed strong emotions to get people's attention." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 7, criterionText: "Is suggestible (easily influenced by others or by circumstances).", threshold: 5, total: 8, itemText: "My opinions changed easily based on what people told me, what I read, or what I saw on television." },
  { disorder: "Histrionic Personality Disorder", criterionNumber: 8, criterionText: "Considers relationships to be more intimate than they actually are.", threshold: 5, total: 8, itemText: "I shared my feelings and developed close friendships with people I had just met." },

  // ---------- Narcissistic Personality Disorder (≥5 of 9) ----------
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 1, criterionText: "Grandiose sense of self-importance (exaggerates achievements/talents, expects to be recognized as superior without commensurate achievement).", threshold: 5, total: 9, itemText: "I felt I was more important than other people." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 1, criterionText: "Grandiose sense of self-importance (exaggerates achievements/talents, expects to be recognized as superior without commensurate achievement).", threshold: 5, total: 9, itemText: "Other people said I exaggerated my achievements." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 2, criterionText: "Preoccupied with fantasies of unlimited success, power, brilliance, beauty, or ideal love.", threshold: 5, total: 9, itemText: "I thought a lot about being very powerful, successful, intelligent, or beautiful." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 3, criterionText: "Believes they are “special” and unique and can only be understood by, or should associate with, other special or high-status people or institutions.", threshold: 5, total: 9, itemText: "I thought that only very talented or intelligent people could really understand me." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 3, criterionText: "Believes they are “special” and unique and can only be understood by, or should associate with, other special or high-status people or institutions.", threshold: 5, total: 9, itemText: "I only wanted to spend time with very important, talented, or intelligent people." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 4, criterionText: "Requires excessive admiration.", threshold: 5, total: 9, itemText: "It was very important to me that I be admired by other people." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 5, criterionText: "Has a sense of entitlement (unreasonable expectations of especially favorable treatment or automatic compliance with their expectations).", threshold: 5, total: 9, itemText: "I expected special treatment from other people." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 5, criterionText: "Has a sense of entitlement (unreasonable expectations of especially favorable treatment or automatic compliance with their expectations).", threshold: 5, total: 9, itemText: "I thought people should automatically do what I told them because of who I am." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 6, criterionText: "Is interpersonally exploitative (takes advantage of others to achieve their own ends).", threshold: 5, total: 9, itemText: "I got other people to do what I wanted, even when they disagreed." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 6, criterionText: "Is interpersonally exploitative (takes advantage of others to achieve their own ends).", threshold: 5, total: 9, itemText: "Other people might have thought that I took advantage of them." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 7, criterionText: "Lacks empathy — unwilling to recognize or identify with the feelings and needs of others.", threshold: 5, total: 9, itemText: "I felt sad when something bad happened to a friend.", reverseScored: true },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 8, criterionText: "Is often envious of others, or believes that others are envious of them.", threshold: 5, total: 9, itemText: "People were jealous of me.", notes: "Covers only the ‘believes others are envious’ half of this criterion; SAGE-SR has no item for the ‘is envious of others’ half." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 9, criterionText: "Shows arrogant, haughty behaviors or attitudes.", threshold: 5, total: 9, itemText: "I thought I deserved the power, status, or recognition that other people had." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 9, criterionText: "Shows arrogant, haughty behaviors or attitudes.", threshold: 5, total: 9, itemText: "People might have thought I was arrogant or “snobby”." },
  { disorder: "Narcissistic Personality Disorder", criterionNumber: 9, criterionText: "Shows arrogant, haughty behaviors or attitudes.", threshold: 5, total: 9, itemText: "I felt very few people deserved my time or attention." },

  // ---------- Avoidant Personality Disorder (≥4 of 7) ----------
  { disorder: "Avoidant Personality Disorder", criterionNumber: 1, criterionText: "Avoids occupational activities that involve significant interpersonal contact, due to fears of criticism, disapproval, or rejection.", threshold: 4, total: 7, itemText: "I avoided working with other people because I was afraid of being criticized." },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 1, criterionText: "Avoids occupational activities that involve significant interpersonal contact, due to fears of criticism, disapproval, or rejection.", threshold: 4, total: 7, itemText: "I avoided taking jobs that required interacting with other people.", notes: UNSURFACED_NOTE },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 2, criterionText: "Unwilling to get involved with people unless certain of being liked.", threshold: 4, total: 7, itemText: "I avoided meeting new people unless I was certain they would like me." },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 2, criterionText: "Unwilling to get involved with people unless certain of being liked.", threshold: 4, total: 7, itemText: "I avoided participating in group activities unless I was certain everyone would like me." },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 3, criterionText: "Shows restraint within intimate relationships due to fear of being shamed or ridiculed.", threshold: 4, total: 7, itemText: "I avoided sharing my thoughts or feelings with close friends or romantic partners because I was afraid they would make fun of me." },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 4, criterionText: "Is preoccupied with being criticized or rejected in social situations.", threshold: 4, total: 7, itemText: "I spent a lot of time worrying about being criticized or rejected in social situations.", notes: UNSURFACED_NOTE },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 5, criterionText: "Is inhibited in new interpersonal situations because of feelings of inadequacy.", threshold: 4, total: 7, itemText: "I was uncomfortable or quiet when meeting new people because I felt inadequate.", notes: UNSURFACED_NOTE },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 6, criterionText: "Views self as socially inept, personally unappealing, or inferior to others.", threshold: 4, total: 7, itemText: "I saw myself as awkward, unattractive, unlikeable, or not as good as others.", notes: UNSURFACED_NOTE },
  { disorder: "Avoidant Personality Disorder", criterionNumber: 7, criterionText: "Is unusually reluctant to take personal risks or engage in new activities because they may prove embarrassing.", threshold: 4, total: 7, itemText: "I avoided taking personal risks or participating in new activities because I might feel embarrassed.", notes: UNSURFACED_NOTE },

  // ---------- Dependent Personality Disorder (≥5 of 8) ----------
  { disorder: "Dependent Personality Disorder", criterionNumber: 1, criterionText: "Has difficulty making everyday decisions without an excessive amount of advice and reassurance from others.", threshold: 5, total: 8, itemText: "I needed a lot of advice or approval from others to make everyday decisions." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 2, criterionText: "Needs others to assume responsibility for most major areas of their life.", threshold: 5, total: 8, itemText: "I depended on other people to take full responsibility for managing many important aspects of my life, such as my personal finances, where to live, or which job to take." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 3, criterionText: "Has difficulty expressing disagreement with others because of fear of loss of support or approval.", threshold: 5, total: 8, itemText: "I had difficulty telling people I disagreed with them because I was afraid they would stop liking me." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 4, criterionText: "Has difficulty initiating projects or doing things on their own, due to lack of self-confidence rather than lack of motivation or energy.", threshold: 5, total: 8, itemText: "I had difficulty starting new projects or doing things on my own because I lacked confidence.", notes: UNSURFACED_NOTE },
  { disorder: "Dependent Personality Disorder", criterionNumber: 5, criterionText: "Goes to excessive lengths to obtain nurturance and support from others, to the point of volunteering to do unpleasant things.", threshold: 5, total: 8, itemText: "I offered to do something very unpleasant, such as cleaning a toilet, so that other people would continue to support or care for me." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 6, criterionText: "Feels uncomfortable or helpless when alone because of exaggerated fears of being unable to care for themselves.", threshold: 5, total: 8, itemText: "I felt uncomfortable when I was alone because I was afraid I would be unable to take care of myself." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 7, criterionText: "Urgently seeks another relationship as a source of care and support when a close relationship ends.", threshold: 5, total: 8, itemText: "If a close relationship had ended, I would have done everything I could to find someone to support or care for me.", notes: "Same item also mapped under Borderline criterion 1." },
  { disorder: "Dependent Personality Disorder", criterionNumber: 8, criterionText: "Is unrealistically preoccupied with fears of being left to take care of themselves.", threshold: 5, total: 8, itemText: "I worried a lot about being left alone to take care of myself.", notes: "Same item also mapped under Borderline criterion 1." },

  // ---------- Obsessive-Compulsive Personality Disorder (≥4 of 8; criteria 4 and 7 deliberately excluded) ----------
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 1, criterionText: "Preoccupied with details, rules, lists, order, organization, or schedules to the extent that the major point of the activity is lost.", threshold: 4, total: 8, itemText: "It was so important to me to have everything in order and to follow rules, that I might have missed the overall purpose of the activity." },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 2, criterionText: "Shows perfectionism that interferes with task completion.", threshold: 4, total: 8, itemText: "I was unable to complete tasks or projects on time because I thought that they needed to be perfect.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 3, criterionText: "Excessively devoted to work and productivity to the exclusion of leisure activities and friendships.", threshold: 4, total: 8, itemText: "Being productive was more important to me than taking time to have fun or having time to relax.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 3, criterionText: "Excessively devoted to work and productivity to the exclusion of leisure activities and friendships.", threshold: 4, total: 8, itemText: "My friends or family complained that I was too devoted to my work.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 5, criterionText: "Unable to discard worn-out or worthless objects even when they have no sentimental value.", threshold: 4, total: 8, itemText: "My home was so filled with objects that it was difficult for me to get around or find what I needed." },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 5, criterionText: "Unable to discard worn-out or worthless objects even when they have no sentimental value.", threshold: 4, total: 8, itemText: "I kept worn-out items that lacked sentimental value because I might need them someday.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 6, criterionText: "Reluctant to delegate tasks or work with others unless they submit to exactly their way of doing things.", threshold: 4, total: 8, itemText: "I did things myself because no one else would do them correctly.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 6, criterionText: "Reluctant to delegate tasks or work with others unless they submit to exactly their way of doing things.", threshold: 4, total: 8, itemText: "When I asked people to do things, I expected them to be done exactly my way.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 8, criterionText: "Shows rigidity and stubbornness.", threshold: 4, total: 8, itemText: "People might have thought I was stubborn.", notes: UNSURFACED_NOTE },
  { disorder: "Obsessive-Compulsive Personality Disorder", criterionNumber: 8, criterionText: "Shows rigidity and stubbornness.", threshold: 4, total: 8, itemText: "Once I made a decision, I was determined to follow it through no matter what.", notes: UNSURFACED_NOTE },
  // criterion 4 ("overconscientious about ethics/morality/values") and criterion 7 ("miserly
  // spending style") deliberately excluded — see file header comment
]

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  let inserted = 0
  let skipped = 0

  for (const row of ROWS) {
    const [existing] = await db
      .select({ id: sageSrPersonalityCriteriaReference.sageSrPersonalityCriteriaReferenceId })
      .from(sageSrPersonalityCriteriaReference)
      .where(
        and(
          eq(sageSrPersonalityCriteriaReference.disorder, row.disorder),
          eq(sageSrPersonalityCriteriaReference.criterionNumber, row.criterionNumber),
          eq(sageSrPersonalityCriteriaReference.itemText, row.itemText)
        )
      )
      .limit(1)

    if (existing) {
      skipped++
      continue
    }

    await db.insert(sageSrPersonalityCriteriaReference).values({
      disorder: row.disorder,
      criterionNumber: row.criterionNumber,
      criterionText: row.criterionText,
      thresholdRequired: row.threshold,
      totalCriteria: row.total,
      itemText: row.itemText,
      reverseScored: row.reverseScored ?? false,
      notes: row.notes ?? null,
    })
    inserted++
  }

  console.log(`SAGE-SR personality criteria reference seeded: ${inserted} inserted, ${skipped} already present.`)
  await pool.end()
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
