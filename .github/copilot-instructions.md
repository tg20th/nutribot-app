# GitHub Copilot Instructions - NutriBot (SWP391 Group 7)

## Project Overview
NutriBot is a personalized nutrition consulting system.
- Backend: Java 25, Spring Boot 3, JPA, Spring Security 6, JWT, MySQL 8
- Frontend: React 19, Vite, Tailwind CSS / Vanilla CSS, Axios
- AI Microservice: Python 3.12+, FastAPI, Uvicorn, Google Gemini API SDK
- Jira Workspace: `https://danyngo06.atlassian.net` (Project Key: `NB`)

## Team Members
- Trường: Backend (Auth, Security, Content, Comments, Admin APIs)
- Thắng: Backend (UserProfile, Health Metrics, BMI, Category, Weekly Menu, GPS)
- Lan: AI & Frontend (Python FastAPI, Gemini Prompt, Meal Planner + React UI Auth, Profile, Chatbot)
- Khánh: BA & Frontend (React UI Admin Dashboard, Blog/Video, Comment/Vote, Map GPS)

## Mandatory Guidelines
1. Always adhere to `API_CONTRACTS.md` for JSON request/response formats (`success`, `message`, `data`, `timestamp`).
2. Always refer to `backend/sql/Database.sql` for table names and column definitions.
3. Check `PROJECT_TODO.md` for task specifications and update task checkbox `[x]` upon completion.
   - **AFTER PR MERGED TO `master`:** Create a separate commit `chore: cập nhật PROJECT_TODO.md - <description>` to update the task checkbox and push to `master`.
4. Git commit messages must be 100% in Vietnamese, following the Git 50/72 rule:
   `<type>(NB-<task_id>-<LAYER>): <Tiêu đề ngắn 50-72 ký tự tiếng Việt> [#done]`
5. Branch naming convention: `feat/NB-<task_id>-<short_name>-<member_name>`.
