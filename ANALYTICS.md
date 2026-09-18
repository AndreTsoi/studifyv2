# How the insights work

## Shared rules

- Never label a pattern causal. The user chooses study methods, duration, and timing; there is no random assignment.
- Self-reported ratings and exam results are separate outcome measures.
- Cross-course exam comparisons are disabled in the all-courses view. Select one course to unlock them.
- Study dates use the UTC timestamp plus the historical UTC offset recorded when the session was entered. A change in device timezone does not relabel old sessions.
- An exam preparation window includes sessions in the preceding 14 calendar days, strictly before exam day and after the preceding exam date for that course. Exam-day studying is excluded because the exam time is unknown. Sessions before the previous exam cannot be reused for the next exam.
- Exams without observed preparation do not enter exam comparisons. This avoids interpreting missing logs as zero studying, but may still create selection bias.
- Same-day assessments can share a preparation window; their outcomes are not independent.
- At least 5 observations are required in each comparison group to show a difference. Below that, only progress toward the threshold is shown.
- Differences include an approximate normal 99% interval using the separate group sample variances. It is descriptive, not a formal hypothesis test or a multiplicity-adjusted guarantee. Normal intervals are unstable for small samples.
- A comparison is labeled Moderate only with at least 20 observations per group, nonzero estimated standard error, and an interval excluding zero. Otherwise it remains Exploratory. Moderate does not mean proven, causal, or predictive.
- Repeated sessions and exams from one person are dependent. The displayed interval does not model that dependence. Confidence is intentionally never labeled High.

## Seven summaries

| Summary                                | Definition                                                                                                                                              | Limit                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Session length and diminishing returns | Mean ratings for 30–90 minute sessions vs sessions longer than 90 minutes                                                                               | Sessions below 30 minutes excluded from this comparison; no claim about retention or productivity per minute  |
| Session sweet spot                     | 15-minute duration buckets, minimum 5 sessions per bucket and 2 eligible buckets; shrink each bucket toward the overall mean with 5 pseudo-observations | Highest adjusted observed bucket, not a proven optimal duration                                               |
| Distributed preparation                | Exam scores after studying on 4+ distinct days vs 1–2 days                                                                                              | 3-day group omitted to make the contrast explicit; total study time and exam difficulty are not controlled    |
| Last-minute concentration              | Exam scores when at least 70% of logged preparation occurred in the final 3 days vs less than 70%                                                       | No hard-coded cramming penalty; this is an observed contrast                                                  |
| Study method variety                   | Exam scores following 3+ methods vs exactly 1 method                                                                                                    | 2-method preparation omitted; does not choose the best method                                                 |
| Preparation recency                    | Scores with less than half of preparation in the last 3 days vs at least half                                                                           | Describes timing; does not estimate a memory decay curve                                                      |
| Focus recipe                           | Local morning (<12), afternoon (<17), or evening; method; and ≤60 vs >60 minutes, requiring 8 sessions in 2 combinations                                | Uses all ratings and 8 pseudo-observations for shrinkage; exploratory winner is susceptible to selection bias |

## Grades

`recorded grade = sum((grade / maximum) * 100 * weight) / sum(weight)`

Only recorded nonfuture exams participate. Zero total weight yields no grade, not 0%. This is the normalized grade across recorded work, not a projected final course grade. Weights are user-defined; the application does not impose a universal grading policy.

## Next analytical steps

Collect explicit recall outcomes, session goals, and exam timestamps. Validate candidate patterns on future data instead of the data that selected them. Consider course-specific covariates, repeated-measures models, and held-out predictive evaluation only once enough observations exist. An attractive dashboard should not imply stronger evidence than the data supports.
