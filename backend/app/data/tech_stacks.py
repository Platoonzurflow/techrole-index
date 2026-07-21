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
    "ruby-developer": (
        ("Языки", ("Ruby", "SQL", "JavaScript")),
        ("Фреймворки", ("Ruby on Rails", "RSpec", "Sidekiq")),
        ("Инструменты", ("PostgreSQL", "Redis", "Docker", "Git")),
    ),
    "javascript-typescript-developer": (
        ("Языки", ("JavaScript", "TypeScript", "HTML", "CSS")),
        ("Платформы", ("Node.js", "React", "Next.js", "NestJS")),
        ("Инструменты", ("npm/pnpm", "Vite", "Jest", "Git")),
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
    "cloud-engineer": (
        ("Облака", ("AWS", "Azure", "Yandex Cloud", "GCP")),
        ("Инфраструктура", ("Terraform", "Kubernetes", "Docker")),
        ("Инструменты", ("CloudFormation", "Ansible", "Prometheus", "GitLab CI")),
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
    "analytics-engineer": (
        ("Языки", ("SQL", "Python", "Jinja")),
        ("Трансформации", ("dbt", "Airflow", "Dagster")),
        ("Хранилища", ("ClickHouse", "BigQuery", "Snowflake", "PostgreSQL")),
    ),
    "database-administrator": (
        ("СУБД", ("PostgreSQL", "Oracle", "MS SQL", "MySQL")),
        ("Администрирование", ("Backup/restore", "Replication", "Performance tuning")),
        ("Инструменты", ("Linux", "Ansible", "Prometheus", "Grafana")),
    ),
    "postgresql-dba": (
        ("СУБД", ("PostgreSQL", "Patroni", "PgBouncer")),
        ("Диагностика", ("pg_stat_statements", "EXPLAIN", "pgBadger")),
        ("Инструменты", ("Linux", "Ansible", "Prometheus", "WAL-G")),
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
    "nlp-engineer": (
        ("Языки", ("Python", "SQL", "C++")),
        ("NLP", ("Transformers", "PyTorch", "spaCy", "SentencePiece")),
        ("Инструменты", ("Hugging Face", "MLflow", "FastAPI", "Docker")),
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
    "soc-analyst": (
        ("Мониторинг", ("SIEM", "EDR", "IDS/IPS", "SOAR")),
        ("Анализ", ("MITRE ATT&CK", "Threat Intelligence", "YARA", "Sigma")),
        ("Инструменты", ("Splunk", "ELK", "Wireshark", "VirusTotal")),
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
    "unreal-engine-developer": (
        ("Языки", ("C++", "Blueprints", "HLSL")),
        ("Движок", ("Unreal Engine", "Niagara", "Gameplay Ability System")),
        ("Инструменты", ("Visual Studio", "Perforce", "Blender", "Unreal Insights")),
    ),
    "embedded-developer": (
        ("Языки", ("C", "C++", "Python", "Assembly")),
        ("Платформы", ("ARM", "STM32", "ESP32", "FreeRTOS")),
        ("Инструменты", ("CMake", "GDB", "JTAG", "Oscilloscope")),
    ),
    "firmware-engineer": (
        ("Языки", ("C", "C++", "Assembly", "Python")),
        ("Микроконтроллеры", ("STM32", "ARM Cortex", "AVR", "ESP32")),
        ("Инструменты", ("FreeRTOS", "JTAG", "Logic analyzer", "Git")),
    ),
    "1c-developer": (
        ("Платформа", ("1С:Предприятие 8", "БСП", "СКД")),
        ("Языки и запросы", ("Встроенный язык 1С", "Язык запросов 1С", "SQL")),
        ("Интеграции", ("HTTP-сервисы", "OData", "XML/JSON", "Git")),
    ),
    "sap-developer": (
        ("Языки", ("ABAP", "SQLScript", "JavaScript")),
        ("Платформа", ("SAP S/4HANA", "SAP BTP", "SAP Fiori")),
        ("Инструменты", ("CDS Views", "OData", "HANA", "Eclipse ADT")),
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
