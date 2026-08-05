from __future__ import annotations

TechStack = tuple[tuple[str, tuple[str, ...]], ...]


TECH_STACKS: dict[str, TechStack] = {
    "frontend-developer": (
        ("Языки", ("JavaScript", "TypeScript", "HTML", "CSS")),
        ("Фреймворки", ("React", "Next.js", "Vue.js")),
        ("Инструменты", ("Git", "Vite", "REST API", "Figma")),
    ),
    "backend-developer": (
        ("Языки", ("Python", "Java", "Go", "TypeScript")),
        ("Backend", ("FastAPI", "Spring Boot", "NestJS", "gRPC")),
        ("Данные и инфраструктура", ("PostgreSQL", "Redis", "Docker", "Kafka")),
    ),
    "fullstack-developer": (
        ("Языки", ("TypeScript", "JavaScript", "Python", "SQL")),
        ("Фреймворки", ("React", "Next.js", "Node.js", "FastAPI")),
        ("Инструменты", ("PostgreSQL", "Docker", "Git", "REST/GraphQL")),
    ),
    "java-developer": (
        ("Языки", ("Java", "SQL", "Kotlin")),
        ("Фреймворки", ("Spring Boot", "Spring Data", "Hibernate")),
        ("Инструменты", ("Maven", "Gradle", "PostgreSQL", "Kafka")),
    ),
    "python-developer": (
        ("Языки", ("Python", "SQL", "Bash")),
        ("Фреймворки", ("FastAPI", "Django", "Flask")),
        ("Инструменты", ("PostgreSQL", "Redis", "Celery", "Docker")),
    ),
    "go-developer": (
        ("Языки", ("Go", "SQL", "Bash")),
        ("Backend", ("Gin", "Echo", "gRPC", "Protocol Buffers")),
        ("Инструменты", ("PostgreSQL", "Redis", "Kafka", "Docker")),
    ),
    "dotnet-developer": (
        ("Языки", ("C#", "SQL", "TypeScript")),
        ("Платформа", (".NET", "ASP.NET Core", "Entity Framework Core")),
        ("Инструменты", ("SQL Server", "PostgreSQL", "Azure", "Docker")),
    ),
    "cpp-developer": (
        ("Языки", ("C++", "C", "Python")),
        ("Библиотеки", ("STL", "Boost", "Qt")),
        ("Инструменты", ("CMake", "GDB", "Git", "Linux")),
    ),
    "php-developer": (
        ("Языки", ("PHP", "SQL", "JavaScript")),
        ("Фреймворки", ("Laravel", "Symfony", "Yii")),
        ("Инструменты", ("MySQL", "PostgreSQL", "Redis", "Docker")),
    ),
    "technical-writer": (
        ("Документация", ("Docs as Code", "API Reference", "User Guide", "Release Notes")),
        ("Форматы", ("Markdown", "OpenAPI", "AsciiDoc", "XML")),
        ("Инструменты", ("Git", "Confluence", "Swagger", "Vale")),
    ),
    "qa-engineer": (
        ("Тестирование", ("Тест-дизайн", "API testing", "SQL", "DevTools")),
        ("Инструменты", ("Postman", "Swagger", "Charles", "TestRail")),
        ("Автоматизация", ("Playwright", "Selenium", "Pytest", "CI/CD")),
    ),
    "android-developer": (
        ("Языки", ("Kotlin", "Java")),
        ("Android", ("Jetpack Compose", "Android SDK", "Coroutines")),
        ("Инструменты", ("Android Studio", "Gradle", "Room", "Firebase")),
    ),
    "ios-developer": (
        ("Языки", ("Swift", "Objective-C")),
        ("Apple", ("SwiftUI", "UIKit", "Combine")),
        ("Инструменты", ("Xcode", "Core Data", "CocoaPods", "SPM")),
    ),
    "flutter-developer": (
        ("Языки", ("Dart", "Kotlin", "Swift")),
        ("Фреймворк", ("Flutter", "Bloc", "Riverpod")),
        ("Инструменты", ("Android Studio", "Xcode", "Firebase", "Git")),
    ),
    "react-native-developer": (
        ("Языки", ("TypeScript", "JavaScript", "Kotlin", "Swift")),
        ("Фреймворки", ("React Native", "Expo", "Redux Toolkit")),
        ("Инструменты", ("Android Studio", "Xcode", "Metro", "Firebase")),
    ),
    "qa-manual": (
        ("Тестирование", ("Тест-дизайн", "API testing", "SQL", "DevTools")),
        ("Инструменты", ("Postman", "Swagger", "Charles", "DBeaver")),
        ("Управление", ("Jira", "TestRail", "Confluence", "Git")),
    ),
    "qa-automation": (
        ("Языки", ("Python", "Java", "TypeScript", "SQL")),
        ("Автоматизация", ("Pytest", "Selenium", "Playwright", "REST Assured")),
        ("Инструменты", ("Allure", "GitLab CI", "Docker", "Postman")),
    ),
    "sdet": (
        ("Языки", ("Java", "Python", "TypeScript", "SQL")),
        ("Фреймворки", ("JUnit", "Pytest", "Playwright", "Selenium")),
        ("Инженерия", ("CI/CD", "Docker", "Kafka", "Performance testing")),
    ),
    "devops-engineer": (
        ("Автоматизация", ("Bash", "Python", "Ansible", "Terraform")),
        ("Контейнеры", ("Docker", "Kubernetes", "Helm")),
        ("CI и наблюдаемость", ("GitLab CI", "Jenkins", "Prometheus", "Grafana")),
    ),
    "sre": (
        ("Языки", ("Go", "Python", "Bash")),
        ("Платформа", ("Kubernetes", "Linux", "Terraform", "Service Mesh")),
        ("Наблюдаемость", ("Prometheus", "Grafana", "OpenTelemetry", "ELK")),
    ),
    "platform-engineer": (
        ("Платформа", ("Kubernetes", "Docker", "Helm", "Backstage")),
        ("Автоматизация", ("Terraform", "Ansible", "Argo CD", "GitLab CI")),
        ("Облака", ("AWS", "Azure", "Yandex Cloud", "OpenStack")),
    ),
    "system-administrator": (
        ("Системы", ("Linux", "Windows Server", "Active Directory")),
        ("Автоматизация", ("PowerShell", "Bash", "Ansible")),
        ("Сервисы", ("Nginx", "VMware", "Zabbix", "DNS/DHCP")),
    ),
    "network-engineer": (
        ("Сети", ("TCP/IP", "BGP", "OSPF", "VLAN")),
        ("Оборудование", ("Cisco IOS", "Juniper", "MikroTik")),
        ("Инструменты", ("Wireshark", "Ansible", "Zabbix", "NetBox")),
    ),
    "technical-support-specialist": (
        ("Поддержка", ("Service Desk", "Help Desk", "SLA", "ITIL")),
        ("Системы", ("Windows", "Linux", "Active Directory", "TCP/IP")),
        ("Инструменты", ("Jira Service Management", "Confluence", "SQL", "Remote Desktop")),
    ),
    "data-analyst": (
        ("Языки", ("SQL", "Python", "DAX")),
        ("Аналитика", ("Pandas", "Jupyter", "Excel")),
        ("BI", ("Power BI", "Tableau", "DataLens", "Metabase")),
    ),
    "bi-analyst": (
        ("Языки", ("SQL", "DAX", "Power Query M")),
        ("BI", ("Power BI", "Tableau", "Qlik Sense", "DataLens")),
        ("Хранилища", ("PostgreSQL", "ClickHouse", "MS SQL", "Greenplum")),
    ),
    "product-analyst": (
        ("Языки", ("SQL", "Python", "R")),
        ("Продуктовая аналитика", ("A/B-тесты", "Amplitude", "AppMetrica", "GA4")),
        ("Визуализация", ("Tableau", "Power BI", "DataLens", "Jupyter")),
    ),
    "system-analyst": (
        ("Моделирование", ("UML", "BPMN", "C4", "ER-диаграммы")),
        ("Интеграции", ("REST", "SOAP", "Kafka", "OpenAPI")),
        ("Инструменты", ("Confluence", "Jira", "PlantUML", "Postman")),
    ),
    "business-analyst": (
        ("Моделирование", ("BPMN", "UML", "User Story", "Use Case")),
        ("Аналитика", ("Excel", "SQL", "Power BI")),
        ("Инструменты", ("Jira", "Confluence", "Miro", "Figma")),
    ),
    "data-engineer": (
        ("Языки", ("Python", "SQL", "Scala", "Java")),
        ("Обработка данных", ("Apache Spark", "Kafka", "Airflow", "dbt")),
        ("Хранилища", ("ClickHouse", "PostgreSQL", "S3", "Hadoop")),
    ),
    "ux-ui-designer": (
        ("Проектирование", ("User Flow", "Wireframes", "Prototyping", "Design System")),
        ("Исследования", ("CustDev", "Usability Testing", "CJM", "Jobs To Be Done")),
        ("Инструменты", ("Figma", "FigJam", "Miro", "Adobe Creative Cloud")),
    ),
    "database-administrator": (
        ("СУБД", ("PostgreSQL", "Oracle", "MS SQL", "MySQL")),
        ("Администрирование", ("Backup/restore", "Replication", "Performance tuning")),
        ("Инструменты", ("Linux", "Ansible", "Prometheus", "Grafana")),
    ),
    "erp-specialist": (
        ("Платформы", ("1С:Предприятие", "SAP S/4HANA", "SAP ERP", "ERP")),
        ("Анализ", ("Бизнес-процессы", "Функциональные требования", "Интеграции", "Миграция данных")),
        ("Инструменты", ("SQL", "BPMN", "Jira", "Confluence")),
    ),
    "data-scientist": (
        ("Языки", ("Python", "SQL", "R")),
        ("ML", ("scikit-learn", "XGBoost", "PyTorch", "TensorFlow")),
        ("Среда", ("Pandas", "Jupyter", "MLflow", "Git")),
    ),
    "machine-learning-engineer": (
        ("Языки", ("Python", "SQL", "C++")),
        ("ML", ("PyTorch", "TensorFlow", "scikit-learn", "ONNX")),
        ("Production", ("FastAPI", "Docker", "Kubernetes", "MLflow")),
    ),
    "mlops-engineer": (
        ("ML-платформа", ("MLflow", "Kubeflow", "Airflow", "Feature Store")),
        ("Инфраструктура", ("Kubernetes", "Docker", "Terraform", "Helm")),
        ("Наблюдаемость", ("Prometheus", "Grafana", "Evidently", "OpenTelemetry")),
    ),
    "ai-engineer": (
        ("Языки", ("Python", "SQL", "TypeScript")),
        ("AI", ("LLM", "Transformers", "RAG", "PyTorch")),
        ("Инструменты", ("Hugging Face", "Vector DB", "FastAPI", "Docker")),
    ),
    "computer-vision-engineer": (
        ("Языки", ("Python", "C++", "CUDA")),
        ("Computer Vision", ("OpenCV", "PyTorch", "YOLO", "TensorRT")),
        ("Инструменты", ("ONNX", "MLflow", "Docker", "Label Studio")),
    ),
    "information-security-specialist": (
        ("Стандарты", ("ISO 27001", "NIST", "ГОСТ", "OWASP")),
        ("Инструменты", ("SIEM", "DLP", "EDR", "Vulnerability scanners")),
        ("Системы", ("Linux", "Windows", "Active Directory", "TCP/IP")),
    ),
    "security-engineer": (
        ("Инженерия", ("Threat Modeling", "IAM", "PKI", "Zero Trust")),
        ("Инструменты", ("SIEM", "EDR", "WAF", "Vault")),
        ("Автоматизация", ("Python", "Bash", "Terraform", "Kubernetes")),
    ),
    "system-engineer": (
        ("Системы", ("Linux", "Windows Server", "Active Directory", "Virtualization")),
        ("Интеграция", ("TCP/IP", "DNS", "Storage", "Backup")),
        ("Инструменты", ("Ansible", "PowerShell", "Zabbix", "Git")),
    ),
    "penetration-tester": (
        ("Инструменты", ("Burp Suite", "Nmap", "Metasploit", "Wireshark")),
        ("Языки", ("Python", "Bash", "PowerShell", "JavaScript")),
        ("Методологии", ("OWASP", "PTES", "OSSTMM", "MITRE ATT&CK")),
    ),
    "game-developer": (
        ("Языки", ("C#", "C++", "Lua", "Python")),
        ("Движки", ("Unity", "Unreal Engine", "Godot")),
        ("Инструменты", ("Git LFS", "Blender", "Visual Studio", "Profilers")),
    ),
    "unity-developer": (
        ("Языки", ("C#", "HLSL")),
        ("Движок", ("Unity", "URP/HDRP", "DOTS", "Addressables")),
        ("Инструменты", ("Rider", "Git LFS", "Blender", "Unity Profiler")),
    ),
    "1c-analyst": (
        ("Платформа", ("1С:Предприятие 8", "1С:ERP", "1С:ЗУП", "1С:Документооборот")),
        ("Анализ", ("Бизнес-процессы", "Функциональные требования", "СКД", "Интеграции")),
        ("Инструменты", ("BPMN", "SQL", "Confluence", "Jira")),
    ),
    "embedded-developer": (
        ("Языки", ("C", "C++", "Python", "Assembly")),
        ("Платформы", ("ARM", "STM32", "ESP32", "FreeRTOS")),
        ("Инструменты", ("CMake", "GDB", "JTAG", "Oscilloscope")),
    ),
    "it-project-manager": (
        ("Управление", ("Agile", "Scrum", "Kanban", "Waterfall")),
        ("Планирование", ("Roadmap", "Backlog", "Risk Management", "Budget")),
        ("Инструменты", ("Jira", "Confluence", "Miro", "MS Project")),
    ),
    "1c-developer": (
        ("Платформа", ("1С:Предприятие 8", "БСП", "СКД")),
        ("Языки и запросы", ("Встроенный язык 1С", "Язык запросов 1С", "SQL")),
        ("Интеграции", ("HTTP-сервисы", "OData", "XML/JSON", "Git")),
    ),
    "product-manager": (
        ("Продукт", ("Product Discovery", "Roadmap", "Jobs To Be Done", "CustDev")),
        ("Аналитика", ("Unit Economics", "A/B-тесты", "SQL", "Product Metrics")),
        ("Инструменты", ("Jira", "Confluence", "Miro", "Figma")),
    ),
    "solution-architect": (
        ("Архитектура", ("C4", "UML", "DDD", "Event-driven architecture")),
        ("Интеграции", ("REST", "gRPC", "Kafka", "API Gateway")),
        ("Платформы", ("Kubernetes", "PostgreSQL", "Cloud", "Terraform")),
    ),
}


def tech_stack_for(slug: str) -> list[dict[str, str | list[str]]]:
    return [
        {"title": title, "items": list(items)} for title, items in TECH_STACKS.get(slug, ())
    ]
