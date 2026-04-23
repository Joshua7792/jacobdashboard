"""Project-wide constants for the Cordillera workforce dashboard.

The training catalog below mirrors "Anejo 3: Forma Para Documentar
Adiestramientos de Contratistas" — the authoritative compliance sheet Lilly
del Caribe requires from every contractor on the Cordillera project. Names
match the PDF exactly (including the "Mansory" spelling) so auditors can
trace any record back to the source document.
"""

DEFAULT_COMPANY_NAME = "Cordillera"

DEFAULT_CONTRACTORS = [
    "GeoEnvirotech",
    "Cornerstone",
]

LEGACY_DEMO_COMPANY_NAMES = [
    "Atlas Industrial Services",
    "Summit Electrical Group",
    "Harbor Mechanical",
]

DEMO_CONTRACTOR_MAPPINGS = {
    "Atlas Prime": "GeoEnvirotech",
    "North Ridge": "GeoEnvirotech",
    "VoltWorks": "Cornerstone",
    "Harbor Energy": "Cornerstone",
}

CATEGORY_PRIMARY = "primary"
CATEGORY_OTROS = "otros"

# Every entry is a required training for workers on Cordillera.
# - name: canonical Spanish label as it appears in the PDF
# - aliases: English / alternate phrasings used in bilingual PDFs
# - category: "primary" (Tabla 1) or "otros" (Tabla 2)
# - order: column index inside its table, matching Anejo 3
TRAINING_CATALOG = [
    # Tabla 1 — Adiestramientos primarios (13)
    {
        "name": "Protección Contra Caídas",
        "aliases": ["Fall Protection", "Proteccion Contra Caidas"],
        "category": CATEGORY_PRIMARY,
        "order": 1,
    },
    {
        "name": "Flama Expuesta",
        "aliases": ["Hot Work", "Open Flame", "Flama Abierta"],
        "category": CATEGORY_PRIMARY,
        "order": 2,
    },
    {
        "name": "Espacios Confinados",
        "aliases": ["Confined Spaces", "Confined Space"],
        "category": CATEGORY_PRIMARY,
        "order": 3,
    },
    {
        "name": "Manejo de Equipo Motorizado",
        "aliases": [
            "Powered Industrial Truck",
            "Powered Industrial Trucks",
            "Forklift",
            "PIT",
        ],
        "category": CATEGORY_PRIMARY,
        "order": 4,
    },
    {
        "name": "Excavación o Zanja",
        "aliases": ["Excavation or Trenching", "Excavation", "Trenching", "Excavacion o Zanja"],
        "category": CATEGORY_PRIMARY,
        "order": 5,
    },
    {
        "name": "Manejo de Tijeras (Scissor lift)",
        "aliases": ["Manejo de Tijeras", "Scissor Lift", "Scissor Lifts", "Aerial Lift"],
        "category": CATEGORY_PRIMARY,
        "order": 6,
    },
    {
        "name": "Seguridad Eléctrica",
        "aliases": ["Electrical Safety", "Seguridad Electrica"],
        "category": CATEGORY_PRIMARY,
        "order": 7,
    },
    {
        "name": "Lockout",
        "aliases": ["Lockout/Tagout", "LOTO", "Lockout Tagout"],
        "category": CATEGORY_PRIMARY,
        "order": 8,
    },
    {
        "name": "Manejo de Grúas",
        "aliases": ["Crane Operation", "Cranes", "Manejo de Gruas"],
        "category": CATEGORY_PRIMARY,
        "order": 9,
    },
    {
        "name": "Escaleras",
        "aliases": ["Ladders", "Ladder Safety"],
        "category": CATEGORY_PRIMARY,
        "order": 10,
    },
    {
        "name": "Andamios",
        "aliases": ["Scaffolds", "Scaffolding"],
        "category": CATEGORY_PRIMARY,
        "order": 11,
    },
    {
        "name": "Trabajos con Plomo o Asbesto",
        "aliases": ["Lead or Asbestos Work", "Lead/Asbestos", "Lead and Asbestos"],
        "category": CATEGORY_PRIMARY,
        "order": 12,
    },
    {
        "name": "Comunicación de Riesgos",
        "aliases": ["Hazard Communication", "HazCom", "Comunicacion de Riesgos"],
        "category": CATEGORY_PRIMARY,
        "order": 13,
    },
    # Tabla 2 — Otros adiestramientos (7)
    {
        "name": "Jacobs/Lilly Inducción",
        "aliases": ["Jacobs/Lilly Induction", "Jacobs Lilly Induction", "Induccion Jacobs/Lilly"],
        "category": CATEGORY_OTROS,
        "order": 14,
    },
    {
        "name": "OSHA 10",
        "aliases": ["OSHA-10", "OSHA10"],
        "category": CATEGORY_OTROS,
        "order": 15,
    },
    {
        "name": "OSHA 30",
        "aliases": ["OSHA-30", "OSHA30"],
        "category": CATEGORY_OTROS,
        "order": 16,
    },
    {
        "name": "Rebar Safety",
        "aliases": ["Seguridad de Varilla", "Rebar"],
        "category": CATEGORY_OTROS,
        "order": 17,
    },
    {
        "name": "Formwork & Shoring",
        "aliases": ["Formwork and Shoring", "Encofrado y Apuntalamiento", "Formwork Shoring"],
        "category": CATEGORY_OTROS,
        "order": 18,
    },
    {
        "name": "Silica Exposure",
        "aliases": ["Exposición a Sílice", "Silica", "Exposicion a Silice"],
        "category": CATEGORY_OTROS,
        "order": 19,
    },
    {
        "name": "Concrete & Mansory",
        "aliases": [
            "Concrete & Masonry",
            "Concrete and Masonry",
            "Concreto y Mampostería",
            "Concreto y Mamposteria",
        ],
        "category": CATEGORY_OTROS,
        "order": 20,
    },
]

TRAINING_CATALOG_BY_NAME = {item["name"]: item for item in TRAINING_CATALOG}
