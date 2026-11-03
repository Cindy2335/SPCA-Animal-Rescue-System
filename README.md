# SPCA Animal Rescue System

## Project Overview

The SPCA Animal Rescue System is a web and mobile application developed to support animal rescue operations, improve communication and make animal adoption services more accessible.

The system aims to assist users in reporting stray animals, reporting animal cruelty and finding animals available for adoption, while providing administrators with tools to manage rescue-related activities.

## Problem Statement

Traditional animal rescue processes can involve challenges such as:
- Difficulty reporting stray animals.
- Limited accessibility to information about animals available for adoption.
- Delays in communication between the public and rescue organisations.
- Administrative challenges when managing animal-related reports and adoption requests.

This project aims to improve these processes through a digital solution.

## Key Features

- **Stray Animal Reporting:** Users can submit reports about stray animals.
- **Animal Adoption:** Browse animals available for adoption and access adoption-related information.
- **Notifications:** Receive updates.
- **Location Search:** Search for suburbs using postal codes.
- **Rescue Management:** Support the management of animal reports and adoption activities.
- **Business Analytics:** Provide insights into system activity and relevant operational information.

## Technology Stack

| Component | Technologies |
| Mobile Application | React Native, Expo |
| Web Application | React, Vite |
| Backend | Node.js, Express.js |
| Database | SQLite |
| ORM | Prisma |
| Programming Languages | TypeScript, JavaScript |
| Development Environment | Visual Studio Code |
| Deployment | Render |

## System Architecture

The project consists of three main components:

1. **Mobile Application:** Provides users with access to animal rescue and adoption functionality through a mobile interface.
2. **Web Application:** Provides a browser-based interface for accessing the system.
3. **Backend API:** Handles application logic, communication and database operations.


### Prerequisites

- Node.js and npm
- Visual Studio Code
- Expo development environment for the mobile application

### Installation

Clone the repository:

```bash
git clone https://github.com/Cindy2335/SPCA-Animal-Rescue-System.git
```

Navigate into the project:

```bash
cd SPCA-Animal-Rescue-System
```

Install dependencies separately in the relevant application directories:

- `API/API`
- `Mobile-App/mobile-app`
- `Mobile-App/web-app`

Configure the required environment variables using the relevant environment configuration examples.

For the mobile application, start the Expo development server:

```bash
npx expo start
```

Refer to the individual application directories and their package configuration files for the appropriate backend and web application startup commands.

## Project Purpose

This project was developed as part of a university Informatics thrid year project, applying software engineering principles to a real-world problem.

It provided practical experience in full-stack development, mobile application development, API integration, database management and collaborative software development.

## Application Screenshots

### Web Application

!Screenshot 2026-11-02 203139.png)

![Animal Adoption Page]Screenshot 2026-11-02 202938.png
Screenshot 2026-11-02 203002.png

![Reporting Page](Screenshots/reports.png)

### Mobile Application

![Mobile Application Homepage](Screenshots/mobile-homepage.png)

![Mobile Adoption Page](Screenshots/mobile-adoption.png)

## Acknowledgements

Developed as a university software engineering project with the aim of supporting animal rescue and adoption services.

---

**Note:** This project is currently maintained as an academic portfolio project.
