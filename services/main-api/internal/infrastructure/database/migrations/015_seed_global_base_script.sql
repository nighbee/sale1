-- Global Base Script for Script Match Evaluation
-- This is a universal script used to calculate script_match metrics for all calls
INSERT INTO scripts_schema.scripts (id, company_id, team_id, name, file_path_minio, parsed_text, file_type, file_size_bytes, structure, version, is_active, created_by, is_base_script, is_active_base, base_script_metrics, created_at, updated_at)  
VALUES (
    cast('00000000-0000-0000-0000-000000000001' as uuid), 
    NULL, 
    NULL, 
    'Global Base Script', 
    'system/global_base_script.txt', 
    'You are a sales representative. Start with a warm greeting. Introduce yourself and your company. Ask about the client needs. Present your solution. Handle objections professionally. Close with a clear call-to-action. Thank the client for their time.', 
    'txt', 
    512, 
    '{
        "sections": [
            {
                "id": "greeting",
                "name": "Greeting",
                "description": "Warm professional greeting",
                "required_phrases": ["hello", "good day", "thank you for taking my call"],
                "key_points": ["Introduce yourself", "Be friendly and professional"]
            },
            {
                "id": "introduction",
                "name": "Introduction",
                "description": "Introduce yourself and company",
                "required_phrases": ["my name is", "I am calling from"],
                "key_points": ["State your name", "State company name", "Purpose of call"]
            },
            {
                "id": "discovery",
                "name": "Discovery",
                "description": "Ask about client needs",
                "required_phrases": ["can I ask", "what are you looking for", "help you with"],
                "key_points": ["Ask open questions", "Listen actively", "Understand pain points"]
            },
            {
                "id": "presentation",
                "name": "Presentation",
                "description": "Present your solution",
                "required_phrases": ["based on", "I recommend", "our solution"],
                "key_points": ["Align solution to needs", "Highlight benefits", "Unique value proposition"]
            },
            {
                "id": "objections",
                "name": "Objection Handling",
                "description": "Handle client objections professionally",
                "required_phrases": ["I understand", "that is a valid point", "let me address"],
                "key_points": ["Acknowledge concern", "Provide clarification", "Offer alternatives"]
            },
            {
                "id": "closing",
                "name": "Closing",
                "description": "Close with clear call-to-action",
                "required_phrases": ["next steps", "schedule a meeting", "follow up"],
                "key_points": ["Summarize discussion", "Clear next action", "Set timeline"]
            },
            {
                "id": "thank_you",
                "name": "Thank You",
                "description": "Thank the client",
                "required_phrases": ["thank you", "appreciate your time", "pleasure speaking"],
                "key_points": ["Express gratitude", "Reiterate availability"]
            }
        ],
        "llm_instructions": "Evaluate the sales call transcript against this base script. Score how well the sales representative followed each section. Consider: (1) Were all sections covered? (2) Were required phrases used? (3) Were key points addressed? (4) Was the flow logical? Provide a script_match score from 0-100 and detailed feedback for each section.",
        "evaluation_criteria": {
            "greeting": {"weight": 10, "min_score": 5},
            "introduction": {"weight": 15, "min_score": 10},
            "discovery": {"weight": 20, "min_score": 15},
            "presentation": {"weight": 20, "min_score": 15},
            "objections": {"weight": 15, "min_score": 10},
            "closing": {"weight": 15, "min_score": 10},
            "thank_you": {"weight": 5, "min_score": 0}
        }
    }'::jsonb, 
    1, 
    true, 
    NULL, 
    true, 
    true, 
    '{"total_evaluations": 0, "average_score": 0, "last_evaluated_at": null}'::jsonb, 
    now(), 
    now()
);
