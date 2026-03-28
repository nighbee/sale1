# Architecture and SOLID Principles

This document describes the architectural patterns and SOLID principles applied in the AI Transcription and Analytics platform.

## Clean Architecture

The project follows Clean Architecture principles to ensure separation of concerns and maintainability. Each microservice is organized into layers:

### 1. Core (Domain & Use Cases)
Located in `src/core/`. This is the heart of the application.
- **Entities**: Business objects (e.g., `Call`, `Transcript`, `AnalysisReport`).
- **Use Cases**: Orchestrate the flow of data to and from entities, and direct those entities to use their business logic to achieve the goals of the use case.
- **Ports**: Interfaces (Abstract Base Classes in Python) that define how the core interacts with the outside world (e.g., `STTProvider`, `Repository`).

### 2. Adapters (Interface Adapters)
Located in `src/adapters/`. These convert data from the format most convenient for the use cases and entities, to the format most convenient for some external agency like the Database or the Web.
- **Repositories**: Implementations of the core's repository ports using specific databases (e.g., `PostgresRepository`).
- **External API Clients**: Implementations of external service ports (e.g., `DeepgramSTTProvider`).
- **Queue Consumers/Publishers**: Handle messaging (e.g., `BullMQConsumer`, `RedisPublisher`).

### 3. Infrastructure (Frameworks & Drivers)
Located in `src/infrastructure/`. This layer is where all the details go. The Web, the Database, the UI, etc.
- **HTTP/gRPC Servers**: Entry points to the application.
- **Audio Processing**: Low-level audio conversion and manipulation.
- **Monitoring**: Prometheus metrics and logging configurations.

---

## SOLID Principles Applied

### Single Responsibility Principle (SRP)
Each class and module has one, and only one, reason to change.
- `DeepgramSTTProvider` is only responsible for communicating with Deepgram API.
- `ProcessAudioUseCase` is only responsible for the orchestration of the audio processing pipeline.
- `AudioConverter` only handles format conversions.

### Open/Closed Principle (OCP)
The system is open for extension but closed for modification.
- New STT providers can be added by implementing the `STTProvider` interface without changing the `ProcessAudioUseCase`.

### Liskov Substitution Principle (LSP)
Objects of a superclass should be replaceable with objects of its subclasses without affecting the correctness of the program.
- Any implementation of `STTProvider` (OpenAI, Gemini, Deepgram) can be used interchangeably by the use case.

### Interface Segregation Principle (ISP)
Clients should not be forced to depend on methods they do not use.
- Use of specific abstract base classes for different external needs (Storage, STT, Events).

### Dependency Inversion Principle (DIP)
High-level modules should not depend on low-level modules. Both should depend on abstractions.
- Use cases depend on abstract ports (interfaces), not concrete adapter implementations. Dependencies are injected or initialized via factories.

---

## Recent Fixes and Adherence

1. **Deepgram Provider Robustness**: Updated `DeepgramSTTProvider` to safely handle varied response structures from the SDK, maintaining the `STTProvider` interface while improving internal resilience.
2. **Download Resumption**: Fixed `_download_in_chunks` to correctly track bytes and handle partial failures, ensuring the "Infrastructure" layer (audio download) provides reliable data to the "Core" layer.
3. **Empty Transcript Handling**: Enhanced `AnalyzeCallUseCase` to handle edge cases (empty transcripts) at the business logic level, providing clear status updates and avoiding unnecessary external infrastructure (LLM) calls.
4. **Frontend Status Handling**: Updated the UI to reflect the domain status (`error`), providing the user with corrective actions (`ReprocessButton`) that trigger the backend use cases.
5. **Idempotent Data Operations**: Updated `stt-service` and `ai-analytics` database adapters to use `ON CONFLICT (call_id) DO UPDATE` (upsert) for transcripts and analysis reports. This ensures the processing pipeline is idempotent and correctly handles call reprocessing without duplicate key violations.
6. **Unified AI Provider System**: Introduced a multi-provider abstraction for STT and LLM. `STTProviderFactory` and `LLMProviderFactory` dynamically instantiate providers (OpenAI, Gemini, Groq, Deepgram) based on global settings fetched from `main-api`. This centralizes provider configuration and allows for runtime provider/model selection without redeploying microservices.

## AI Provider Integration Guide

### 1. Adding a New STT Provider
To add a new Speech-to-Text provider to `stt-service`:
1.  **Define the Adapter**: Create a new class in `services/stt-service/src/adapters/stt/` (e.g., `MyNewSTTProvider.py`) that implements the `STTProvider` interface from `src/core/ports/stt_provider.py`.
2.  **Update the Factory**: Add the new provider to `STTProviderFactory.create` in `services/stt-service/src/adapters/stt/factory.py`.
3.  **Configure Credentials**: Ensure the provider can fetch its API key from the `integrations` list or environment variables.

### 2. Adding a New LLM Provider
To add a new Large Language Model provider to `ai-analytics`:
1.  **Define the Adapter**: Create a new class in `services/ai-analytics/src/adapters/llm/` that implements the `LLMProvider` interface from `src/core/ports/llm_provider.py`.
2.  **Update the Factory**: Add the new provider to `LLMProviderFactory.create` in `services/ai-analytics/src/adapters/llm/factory.py`.
3.  **Update Frontend**: Add the new provider name to the selection dropdown in `services/frontend/src/pages/Integrations/ui/IntegrationsPage.tsx`.

### 3. Using OpenAI-Compatible APIs
The system supports any OpenAI-compatible API (like Groq, Together AI, or local vLLM).
1.  **Create Integration**: In the Integrations UI, select "OpenAI".
2.  **Set Base URL**: Provide the custom `Base URL` (e.g., `https://api.groq.com/openai/v1`).
3.  **Set Model**: Update the "Default Model" in the AI Provider Settings section of the Integrations page.
