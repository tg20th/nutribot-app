# CLAUDE.md - NutriBot Project Guidelines (Claude Code)

> NutriBot: AI-powered Personalized Nutrition & Diet Planner (SWP391 Group 7)
> Repository: `tg20th/swp391-group7-nutribot` | Jira Project Key: `G7`

## 🔨 BUILD & TEST COMMANDS

### Backend (Spring Boot 3 / Java 25)
- Location: `./backend`
- Build & Run: `./mvnw spring-boot:run` (or `mvn spring-boot:run`)
- Run all tests: `./mvnw test`
- Run single test: `./mvnw test -Dtest=ClassNameTest#methodName`
- Package: `./mvnw clean package -DskipTests`

### Frontend (React 19 / Vite)
- Location: `./frontend`
- Install dependencies: `npm install`
- Dev server: `npm run dev`
- Run tests: `npm test`
- Build production bundle: `npm run build`
- Lint code: `npm run lint`

### AI Microservice (Python 3.12+ / FastAPI)
- Location: `./backend/ai-service` (or root Python AI module)
- Install requirements: `pip install -r requirements.txt`
- Start server: `uvicorn main:app --reload --port 8000`
- Run tests: `pytest`

---

## 🌿 GIT & COMMIT CONVENTIONS (MANDATORY)

### 1. Branch Naming
All branches must follow:
```bash
feat/G7-<task_id>-<short_description>-<member_name>
fix/G7-<task_id>-<short_description>-<member_name>
```
*Examples:*
- `feat/G7-02-register-truong`
- `feat/G7-10-bmi-thang`
- `feat/G7-32-fastapi-lan`
- `feat/G7-16-blog-ui-khanh`

### 2. Commit Message Guidelines (100% VIETNAMESE + 50/72 RULE)
Claude Code MUST format all git commit messages in **100% Vietnamese**, adhering strictly to the **Git 50/72 rule**:

```text
<type>(G7-<task_id>-<LAYER>): <Tiêu đề ngắn 50 - 72 ký tự tiếng Việt> [#done]

- <Gạch đầu dòng 1: Chi tiết file/tính năng đã tạo hoặc chỉnh sửa>
- <Gạch đầu dòng 2: Xử lý logic nghiệp vụ hoặc bảo mật>
- <Gạch đầu dòng 3: Kết quả test>
```

#### Rules:
- `<type>`: `feat` | `fix` | `test` | `refactor`
- `<LAYER>`: `BE` (Backend) | `FE` (Frontend) | `AI` (AI Service)
- `<task_id>`: 2-digit number matching `PROJECT_TODO.md` (e.g. `02`, `10`, `32`)
- Add `#done` at the end of the subject line when completing a task to trigger Jira Smart Commits.
- Use 2-4 bullet points in the body detailing changes and test status.

#### Example Commit:
```bash
git commit -m "feat(G7-02-BE): hoàn thành API đăng ký và mã hóa mật khẩu #done

- Tạo AuthController với endpoint POST /api/v1/auth/register
- Mã hóa mật khẩu người dùng bằng BCryptPasswordEncoder
- Bổ sung kiểm tra trùng lặp email và username trong DB
- Chạy unit test AuthControllerTest đạt 100%"
```

---

## 👥 TEAM MEMBERS & ROLES
- **Trường (Backend):** Auth, Spring Security, JWT, User & Role, Blog/Video, Comment, Admin BE APIs.
- **Thắng (Backend):** User Profile, Health Metrics, Dị ứng, BMI, Menu tuần, Nhà hàng GPS, Java AI Gateway.
- **Lan (AI & Frontend):** Python FastAPI, Gemini prompt, Meal Planner + React UI Auth, Profile, Chatbot, Menu.
- **Khánh (BA & Frontend):** React UI Admin Dashboard, Blog/Video UI, Bình luận/Vote, Nhà hàng & Map GPS.

---

## 📌 PROJECT REFERENCES & WORKFLOW
- **Task Checklist & Assignment:** [`PROJECT_TODO.md`](PROJECT_TODO.md) (Check before starting, and tick `[x]` upon completion)
- **Database Schema:** [`backend/sql/Database.sql`](backend/sql/Database.sql) & [`backend/sql/SampleData.sql`](backend/sql/SampleData.sql) (Map all JPA Entities to these tables)
- **API Response Wrapper & Status Codes:** [`API_CONTRACTS.md`](API_CONTRACTS.md) (Mandatory `ApiResponse<T>` JSON structure: `success`, `message`, `data`, `timestamp`)
- **Human Contribution & Git Guide:** [`CONTRIBUTING.md`](CONTRIBUTING.md)
