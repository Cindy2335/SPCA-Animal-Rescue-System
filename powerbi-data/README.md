# SPCA Power BI dataset

Run `npm run export:powerbi` from the `backend` directory whenever the local database changes.

## Import

In Power BI Desktop, select **Get data > Text/CSV** and import every CSV in this directory. In Power Query, set all `...Id` columns to Text, date-only columns to Date, timestamp columns to Date/Time, and boolean columns to True/False.

## Relationships

Create these one-to-many relationships with single-direction filtering:

- `animals[AnimalId]` -> `adoption-applications[AnimalId]`
- `users[UserId]` -> `adoption-applications[ApplicantUserId]`
- `users[UserId]` -> `stray-reports[ReporterUserId]`
- `users[UserId]` -> `surrenders[OwnerUserId]`
- `calendar[Date]` -> each fact table's `CreatedDate`

Agent relationships can be left inactive because the same user table also represents applicants/reporters. Activate them only in measures that use `USERELATIONSHIP`.

Mark `calendar` as the date table using `calendar[Date]`.

## Suggested visuals

- KPI cards: total animals, applications, successful adoptions, active reports, active surrenders, and registered users.
- Line chart: `calendar[Date]` by application count.
- Donut chart: animal count by `animals[Status]`.
- Column chart: report count by `stray-reports[Status]`.
- Column chart: surrender count by `surrenders[Status]`.
- Donut chart: report count by `stray-reports[ReportingMode]`.

## Starter measures

```DAX
Total Animals = COUNTROWS(animals)
Total Applications = COUNTROWS('adoption-applications')
Successful Adoptions = CALCULATE(COUNTROWS('adoption-applications'), 'adoption-applications'[Status] = "ADOPTED")
Adoption Success Rate = DIVIDE([Successful Adoptions], [Total Applications], 0)
Active Reports = CALCULATE(COUNTROWS('stray-reports'), 'stray-reports'[Status] <> "RESOLVED")
Active Surrenders = CALCULATE(COUNTROWS(surrenders), NOT(surrenders[Status] IN {"COMPLETED", "DECLINED"}))
Registered Users = COUNTROWS(users)
Anonymous Report Rate = DIVIDE(CALCULATE(COUNTROWS('stray-reports'), 'stray-reports'[ReportingMode] = "Anonymous"), COUNTROWS('stray-reports'), 0)
```

This export intentionally excludes passwords, email addresses, phone numbers, home addresses, exact report locations, coordinates, descriptions, notes, and image data.
