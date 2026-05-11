# Quantum SEO Project Documentation

## 1. Purpose of This File

This document explains the `G:\Quantum_SEO` project in plain language.

It covers:

- What the project is trying to do
- How the project currently works
- What every main folder and file is for
- What tools and technologies are used
- What terms like `crawler`, `indexer`, `retrieval`, `ranking`, `AI overview`, `BM25`, and `PageRank` mean
- Which parts are currently active in the running app
- Which parts are architectural or prototype code

This is a codebase-oriented explanation, not just a generic theory document.

---

## 2. What This Project Is

`Quantum SEO` is a search-engine-style project that combines:

- a search UI
- a live search backend
- AI-generated overview responses
- web crawling concepts
- indexing concepts
- ranking concepts
- cloud infrastructure concepts

In simple terms:

- A user types a query into a search bar
- The system finds useful sources
- It ranks and summarizes those sources
- It shows a short AI Overview and a list of results

The codebase contains two layers:

1. A currently runnable local app
2. A broader search architecture prototype for a more advanced production system

---

## 3. Current Runtime vs Planned Architecture

### Current runtime path

The part that currently runs in the browser and local server is mainly:

- [index.html](/G:/Quantum_SEO/index.html)
- [serve.mjs](/G:/Quantum_SEO/serve.mjs)

This path provides:

- the search bar UI
- suggested questions
- AI Overview rendering
- live search calls
- fallback behavior
- trending suggestions
- location widget

### Planned or architectural path

The TypeScript folders describe a larger search system:

- `crawler/`
- `indexer/`
- `gateway/`
- `retrieval/`
- `ranking/`
- `ai/`
- `api/`
- `infrastructure/`

These files describe a more complete search engine design with:

- crawling
- embeddings
- sparse retrieval
- vector retrieval
- rank fusion
- AI answer generation
- cloud deployment

Some of these files are directly usable building blocks.
Some are conceptual or prototype pieces that are not yet wired into the current `serve.mjs` runtime.

---

## 4. High-Level Flow

### Current local app flow

1. User opens the webpage
2. User types a query in the search bar
3. Browser sends request to `/api/search`
4. `serve.mjs` receives the query
5. The backend builds one or more search queries
6. The backend calls live web search
7. Results are cleaned, deduplicated, ranked, and summarized
8. The browser displays:
   - AI Overview
   - citations
   - suggested follow-up questions
   - result cards

### Planned full-stack flow

1. Crawl websites
2. Extract text and links
3. Generate embeddings
4. Store searchable data in indexes and databases
5. Run BM25 and vector retrieval
6. Fuse ranks using RRF
7. Re-rank using a cross-encoder
8. Generate an AI answer from top documents
9. Return final response to frontend

---

## 5. Folder-by-Folder Documentation

## 5.1 `ai/`

This folder contains AI-related business logic.

### What `ai` means

`ai` here refers to code that uses large language models to:

- answer questions from retrieved search results
- generate related search suggestions

### Files

#### [ai/answer-generator.ts](/G:/Quantum_SEO/ai/answer-generator.ts)

Purpose:

- Builds an AI-generated answer from top search results

How:

- Uses Anthropic SDK
- Sends top results as context
- Asks the model to return JSON

Why:

- To create a concise answer block instead of only showing raw links

Main concepts:

- `context`: the retrieved search snippets sent to the model
- `citations`: source URLs the answer should reference
- `confidence`: a model-provided confidence label
- `relatedQueries`: suggested next searches

Use case:

- Showing an `AI Answer` or `AI Overview` above normal results

#### [ai/query-suggester.ts](/G:/Quantum_SEO/ai/query-suggester.ts)

Purpose:

- Generates related search queries

How:

- Uses Anthropic SDK
- Prompts the model to return a JSON array of short related searches

Why:

- Helps users continue exploring a topic

Use case:

- Follow-up questions under the AI answer

---

## 5.2 `api/`

This folder contains HTTP route handlers.

### What `api` means

`API` stands for Application Programming Interface.
In this project it means backend endpoints that the frontend can call.

### Files

#### [api/search-router.ts](/G:/Quantum_SEO/api/search-router.ts)

Purpose:

- Provides a `/search` route using Express

How:

- Validates query parameter `q`
- Calls `runExternalSearchAgent`
- Returns JSON

Why:

- Gives a standard backend search endpoint

Use case:

- Frontend or other services can call `/search?q=...`

#### [api/search-agent-router.ts](/G:/Quantum_SEO/api/search-agent-router.ts)

Purpose:

- Provides a `/search-agent` route

How:

- Same overall pattern as `search-router.ts`
- Also calls `runExternalSearchAgent`

Why:

- Separates the “search agent” endpoint naming from the general search route

Use case:

- Alternative endpoint for agent-style search orchestration

Note:

- In the current running local app, `serve.mjs` handles routing directly instead of Express.

---

## 5.3 `crawler/`

This folder contains crawling and crawl-related support logic.

### What `crawler` means

A `crawler` is a program that visits web pages, reads them, extracts useful content, and collects links to other pages.

It is one of the foundational pieces of a search engine.

### Why a crawler exists

Search engines need source content.
Without crawling, there is no page text, no link graph, and no index to search.

### Files

#### [crawler/crawler.ts](/G:/Quantum_SEO/crawler/crawler.ts)

Purpose:

- Visits a page and extracts structured crawl data

How:

- Uses Playwright with Chromium
- Opens a page in headless mode
- Removes layout noise like `nav`, `footer`, `script`, `style`, `header`, and `aside`
- Extracts visible body text
- Collects outbound links
- Sends the crawled document to an SQS queue

Why:

- To gather raw page data for later indexing

Output data:

- `url`
- `title`
- `body`
- `outboundLinks`
- `crawledAt`

Use case:

- Web page ingestion pipeline

#### [crawler/embedder.ts](/G:/Quantum_SEO/crawler/embedder.ts)

Purpose:

- Converts text into vector embeddings

How:

- Uses Gemini embeddings API (when enabled)
- Uses Gemini embedding model (configured)
- Truncates long text before embedding

Why:

- Vector search needs numeric representations of meaning

What an embedding means:

- An embedding is a list of numbers representing the semantic meaning of text

Use case:

- Semantic search
- Similarity search
- Query-to-document matching

#### [crawler/pagerank.ts](/G:/Quantum_SEO/crawler/pagerank.ts)

Purpose:

- Computes PageRank-like authority scores from a link graph

How:

- Iteratively distributes score over links
- Uses damping factor and repeated passes

Why:

- A page linked by important pages is usually more authoritative

What `PageRank` means:

- A graph-based importance score for pages based on incoming links

Use case:

- Authority boosting during ranking

Important note:

- `computePageRank` contains real PageRank logic
- The Python backend computes iterative PageRank scores from the stored `page_links` graph

---

## 5.4 `frontend/`

This folder contains a React-based frontend component.

### What `frontend` means

The frontend is the user-facing interface code.

### Files

#### [frontend/SearchBar.tsx](/G:/Quantum_SEO/frontend/SearchBar.tsx)

Purpose:

- React search component with suggestions, loading state, results, AI answer, and related queries

How:

- Uses React hooks
- Debounces input
- Calls `/api/suggest` for suggestions
- Calls `/api/search` for results
- Cancels older requests with `AbortController`

Why:

- Represents how a React version of the search UI would work

Use case:

- Component for a React app version of the search page

Important note:

- The current local app is mostly driven by [index.html](/G:/Quantum_SEO/index.html), not by this React component
- `/api/suggest` is referenced here, but that endpoint is not present in the current local runtime

---

## 5.5 `gateway/`

This folder contains query understanding and preprocessing logic.

### What `gateway` means

In this project, `gateway` means the layer that prepares the query before retrieval happens.

It can:

- classify user intent
- expand search terms
- create embeddings

### Files

#### [gateway/query-parser.ts](/G:/Quantum_SEO/gateway/query-parser.ts)

Purpose:

- Parses a raw search query into structured understanding

How:

- Uses Anthropic SDK
- Returns:
  - `intent`
  - `entities`
  - `expandedTerms`
  - `correctedQuery`
  - `isQuestion`

Why:

- Search quality improves when the system understands what the user is asking

What `intent` means:

- The likely purpose of the search

Intent types used:

- `navigational`: user wants a specific website or page
- `informational`: user wants information
- `transactional`: user wants to buy, sign up, or act
- `local`: user wants local information

Use case:

- Query correction and smarter retrieval

#### [gateway/query-expander.ts](/G:/Quantum_SEO/gateway/query-expander.ts)

Purpose:

- Expands a query into more searchable terms

How:

- Splits query into terms
- Merges with provided synonyms
- Removes duplicates

Why:

- Improves recall
- Helps match documents that use different wording

What `query expansion` means:

- Taking a query and adding related terms or synonyms

Use case:

- Better sparse retrieval coverage

#### [gateway/embedder.ts](/G:/Quantum_SEO/gateway/embedder.ts)

Purpose:

- Re-exports embedding functions for query-time use

Why:

- Keeps embedding access available through the gateway layer

Use case:

- Real-time query embedding

---

## 5.6 `indexer/`

This folder contains code that writes data into search/storage systems.

### What `indexer` means

An `indexer` transforms raw crawled data into optimized searchable storage.

### Why indexing matters

Raw crawled pages are too slow and messy to search directly.
Indexes make retrieval fast and structured.

### Files

#### [indexer/bm25-indexer.ts](/G:/Quantum_SEO/indexer/bm25-indexer.ts)

Purpose:

- Creates and writes to an Elasticsearch/OpenSearch text index

How:

- Defines index settings and mappings
- Uses BM25 similarity
- Stores:
  - URL
  - title
  - body
  - pagerank
  - crawledAt

Why:

- BM25 is strong for keyword search and exact term matching

What `BM25` means:

- A standard sparse retrieval ranking formula used in search engines

Use case:

- Text search over titles and body content

#### [indexer/vector-indexer.ts](/G:/Quantum_SEO/indexer/vector-indexer.ts)

Purpose:

- Stores document embeddings in PostgreSQL with pgvector

How:

- Uses `pg`
- Writes vectors into `page_embeddings`
- Uses upsert semantics

Why:

- Needed for vector similarity search

What `pgvector` means:

- A PostgreSQL extension for storing and searching vectors

Use case:

- Semantic retrieval

#### [indexer/graph-indexer.ts](/G:/Quantum_SEO/indexer/graph-indexer.ts)

Purpose:

- Stores link relationships in Neo4j

How:

- Creates `Page` nodes
- Creates `LINKS_TO` relationships

Why:

- Link graphs support authority analysis and graph queries

What `Neo4j` means:

- A graph database designed for node/edge relationships

Use case:

- Link graph modeling
- Authority analysis

---

## 5.7 `infrastructure/`

This folder contains cloud infrastructure definition.

### What `infrastructure` means

This is the deployment and cloud resource layer.

### Files

#### [infrastructure/search-stack.ts](/G:/Quantum_SEO/infrastructure/search-stack.ts)

Purpose:

- Defines AWS infrastructure using CDK

How:

- Creates:
  - VPC
  - S3 bucket
  - SQS queue and DLQ
  - OpenSearch domain
  - ElastiCache replication group
  - Lambda indexer
  - ECS Fargate service

Why:

- Production search systems need durable storage, queues, search engines, and deployable services

What each service means:

- `VPC`: private network boundary in AWS
- `S3`: object storage
- `SQS`: queue for asynchronous processing
- `DLQ`: dead-letter queue for failed messages
- `OpenSearch`: search engine for indexed text queries
- `ElastiCache`: managed cache, often Redis-compatible
- `Lambda`: serverless compute
- `ECS Fargate`: container hosting without managing servers

Use case:

- Production deployment of crawling, indexing, and search services

---

## 5.8 `ranking/`

This folder contains ranking and reranking logic.

### What `ranking` means

Ranking decides the order in which search results are shown.

### Files

#### [ranking/rrf-fusion.ts](/G:/Quantum_SEO/ranking/rrf-fusion.ts)

Purpose:

- Merges multiple ranked result lists using Reciprocal Rank Fusion

How:

- Takes result lists from multiple retrieval methods
- Adds rank-based contributions
- Includes a PageRank influence

Why:

- Different retrieval systems are good at different things
- RRF combines them without relying on raw score comparability

What `RRF` means:

- Reciprocal Rank Fusion
- A ranking method that rewards documents appearing near the top of multiple lists

Use case:

- Hybrid search ranking

#### [ranking/freshness.ts](/G:/Quantum_SEO/ranking/freshness.ts)

Purpose:

- Applies time-based score decay

How:

- Uses exponential decay based on age

Why:

- Older content may need less weight for freshness-sensitive queries

What `freshness decay` means:

- Reducing ranking score as content becomes older

Use case:

- News, updates, and time-sensitive search

#### [ranking/cross-encoder.ts](/G:/Quantum_SEO/ranking/cross-encoder.ts)

Purpose:

- Re-ranks candidate results using Cohere rerank model

How:

- Sends query and document text to Cohere
- Receives more accurate relevance scores

Why:

- Cross-encoders often outperform simple vector similarity for final top results

What `cross-encoder` means:

- A model that reads query and document together to judge relevance

Use case:

- Final top-result reranking

---

## 5.9 `retrieval/`

This folder contains code that fetches candidates from search systems.

### What `retrieval` means

Retrieval is the step where the system finds candidate documents before final ranking.

### Files

#### [retrieval/bm25-retriever.ts](/G:/Quantum_SEO/retrieval/bm25-retriever.ts)

Purpose:

- Re-exports `bm25Search`

Why:

- Makes BM25 retrieval accessible through the retrieval layer

Use case:

- Sparse retrieval pipeline

#### [retrieval/vector-retriever.ts](/G:/Quantum_SEO/retrieval/vector-retriever.ts)

Purpose:

- Searches stored vectors in PostgreSQL

How:

- Embeds the query
- Runs vector similarity query
- Returns top results with cosine-based score

Why:

- Finds semantically similar content even without exact keyword matches

What `vector retrieval` means:

- Retrieval based on embedding similarity rather than exact words

Use case:

- Semantic search

#### [retrieval/pagerank-scorer.ts](/G:/Quantum_SEO/retrieval/pagerank-scorer.ts)

Purpose:

- Looks up PageRank scores

How:

- Calls `getPageRanks`

Why:

- Keeps authority lookup separate from retrieval logic

Use case:

- Ranking enrichment

#### [retrieval/external-search-agent.ts](/G:/Quantum_SEO/retrieval/external-search-agent.ts)

Purpose:

- Runs external live search using Tavily

How:

- Classifies intent
- Builds related search queries
- Calls Tavily
- Cleans and summarizes results
- Applies credibility and recency heuristics
- Builds final answer from summaries

Why:

- Provides live web search without needing a fully self-hosted crawler/index pipeline

What `external search agent` means:

- A search orchestrator that relies on external search APIs instead of only internal indexes

Use case:

- Live web-backed AI Overview generation

Important note:

- This TypeScript file is the Express/TS version
- The current running local app uses a similar implementation inside [serve.mjs](/G:/Quantum_SEO/serve.mjs)

---

## 6. Root-Level Files

### [index.html](/G:/Quantum_SEO/index.html)

Purpose:

- Main current frontend for the local app

What it contains:

- search bar UI
- attach buttons
- voice search support
- suggestion panel
- AI Overview area
- citations
- suggested questions
- results list
- live location card
- typing effect
- client-side search request logic

Why:

- This is the main current browser interface

Use case:

- Local single-page search UI

### [serve.mjs](/G:/Quantum_SEO/serve.mjs)

Purpose:

- Current local Node server

What it does:

- serves static files
- exposes `/api/search`
- exposes `/api/trending`
- loads `.env`
- calls Tavily
- fetches Wikipedia summaries as fallback
- ranks and summarizes live results
- caches recent search responses in memory
- applies timeout/retry logic for live search resilience

Why:

- This is the simplest runnable backend for the project

Use case:

- Local development server

### [package.json](/G:/Quantum_SEO/package.json)

Purpose:

- Project metadata and dependencies

Contains:

- package name
- module type
- scripts
- runtime dependencies
- development dependencies

Why:

- Node projects use this as the package manifest

### [package-lock.json](/G:/Quantum_SEO/package-lock.json)

Purpose:

- Locks exact dependency versions

Why:

- Makes installs repeatable

### [tsconfig.json](/G:/Quantum_SEO/tsconfig.json)

Purpose:

- TypeScript compiler configuration

Important settings:

- `target: ES2022`
- `module: NodeNext`
- `strict: true`
- `jsx: react-jsx`

Why:

- Controls how TypeScript is checked and built

### [wrangler.jsonc](/G:/Quantum_SEO/wrangler.jsonc)

Purpose:

- Cloudflare Wrangler configuration

What it suggests:

- The project can be served as static assets through Cloudflare tooling

Important fields:

- `name`
- `compatibility_date`
- `assets.directory`

Why:

- Supports deployment configuration for Cloudflare-style asset serving

### [.env.example](/G:/Quantum_SEO/.env.example)

Purpose:

- Template environment variable file

Why:

- Shows which secrets and service URLs the project expects

Use case:

- Setup reference for local or production configuration

### [ai-search-engine.md](/G:/Quantum_SEO/ai-search-engine.md)

Purpose:

- Large architecture/reference document for the project concept

Why:

- Describes the intended search engine design in long form

Important note:

- This file is documentation/reference, not executable runtime logic

### [serve.log](/G:/Quantum_SEO/serve.log)

Purpose:

- Log output file from local server runs

### [serve.err](/G:/Quantum_SEO/serve.err)

Purpose:

- Error output file from local server runs

---

## 7. Technologies Used

## 7.1 Node.js

Meaning:

- JavaScript runtime outside the browser

Used for:

- backend server
- scripts
- local app execution

## 7.2 TypeScript

Meaning:

- JavaScript with type checking

Used for:

- most architecture modules
- safer function signatures and data structures

## 7.3 JavaScript `.mjs`

Meaning:

- ES module JavaScript file format

Used for:

- current local server in `serve.mjs`

## 7.4 HTML/CSS/Vanilla JavaScript

Used in:

- `index.html`

Purpose:

- current standalone frontend page

## 7.5 React

Used in:

- `frontend/SearchBar.tsx`

Purpose:

- component-based frontend approach

## 7.6 Express

Meaning:

- web framework for Node.js

Used in:

- `api/` route files

Purpose:

- building HTTP APIs

## 7.7 Gemini

Used for:

- embeddings

Files:

- `crawler/embedder.ts`
- `gateway/embedder.ts`

Use case:

- semantic vector search

## 7.8 Anthropic

Used for:

- query parsing
- answer generation
- related query suggestion

Files:

- `ai/answer-generator.ts`
- `ai/query-suggester.ts`
- `gateway/query-parser.ts`

Use case:

- LLM-assisted search orchestration

## 7.9 Cohere

Used for:

- reranking search results

File:

- `ranking/cross-encoder.ts`

Use case:

- better final top results

## 7.10 Tavily

Used for:

- live web search API

Files:

- `serve.mjs`
- `retrieval/external-search-agent.ts`

Use case:

- live search results without maintaining your own full crawler/index

## 7.11 Playwright

Used for:

- browser-based crawling

File:

- `crawler/crawler.ts`

Use case:

- rendering pages and extracting content

## 7.12 PostgreSQL + pg

Used for:

- vector storage access

Files:

- `indexer/vector-indexer.ts`
- `retrieval/vector-retriever.ts`

Use case:

- storing and querying embeddings

## 7.13 pgvector

Meaning:

- PostgreSQL extension for vectors

Used for:

- embedding similarity search

## 7.14 Elasticsearch / OpenSearch

Used for:

- BM25 indexing and text retrieval

File:

- `indexer/bm25-indexer.ts`

Use case:

- sparse lexical search

## 7.15 Neo4j

Used for:

- link graph storage

File:

- `indexer/graph-indexer.ts`

Use case:

- graph relationships and authority modeling

## 7.16 AWS SDK

Used for:

- SQS communication
- S3-related infrastructure setup

Files:

- `crawler/crawler.ts`
- `infrastructure/search-stack.ts`

## 7.17 AWS CDK

Meaning:

- Infrastructure as code toolkit for AWS

Used for:

- cloud resource definition

File:

- `infrastructure/search-stack.ts`

## 7.18 Cloudflare Wrangler

Used for:

- Cloudflare-style static asset deployment configuration

File:

- `wrangler.jsonc`

## 7.19 Redis / ioredis

Used in concept:

- query result caching

Referenced in:

- `.env.example`
- `package.json`
- architecture docs

Important note:

- The current local runtime in `serve.mjs` uses in-memory caching, not Redis

---

## 8. Search Concepts Explained

## 8.1 Crawler

A crawler visits websites and collects content plus links.

## 8.2 Indexer

An indexer prepares crawled content so it can be searched quickly.

## 8.3 Retrieval

Retrieval is the step that fetches candidate documents for a query.

## 8.4 Ranking

Ranking decides which results should appear first.

## 8.5 BM25

BM25 is a keyword-based retrieval method that scores documents by term relevance.

## 8.6 Vector Search

Vector search finds semantically similar text using embeddings.

## 8.7 Embedding

An embedding is a numeric representation of text meaning.

## 8.8 PageRank

PageRank is a graph-based authority score based on links between pages.

## 8.9 RRF

RRF combines multiple ranked lists into one robust ranking.

## 8.10 Cross-Encoder

A cross-encoder reads both query and document together for more accurate reranking.

## 8.11 AI Overview

An AI Overview is a generated summary built from retrieved sources.

## 8.12 Citation

A citation is a source reference used to support an answer.

## 8.13 Fallback

A fallback is a backup behavior used when the main path fails.

In this project:

- Wikipedia can act as fallback content
- local previews can act as fallback UI state

---

## 9. Environment Variables and Why They Exist

Based on [.env.example](/G:/Quantum_SEO/.env.example), the project expects:

### `GEMINI_API_KEY`

Why:

- Needed for Gemini embeddings (when enabled)

### `ANTHROPIC_API_KEY`

Why:

- Needed for query parsing and AI answer generation

### `COHERE_API_KEY`

Why:

- Needed for reranking

### `ELASTICSEARCH_URL`

Why:

- Needed to connect to Elasticsearch/OpenSearch

### `DATABASE_URL`

Why:

- Needed to connect to PostgreSQL/pgvector

### `REDIS_URL`

Why:

- Intended for caching in fuller architecture

### `CRAWL_QUEUE_URL`

Why:

- Needed to send crawled pages into SQS for indexing

### `AWS_REGION`

Why:

- Needed for AWS SDK configuration

### `TAVILY_API_KEY`

Why:

- Needed for live web search in current runtime

---

## 10. What Is Active Right Now

The currently active local app is centered on:

- [index.html](/G:/Quantum_SEO/index.html)
- [serve.mjs](/G:/Quantum_SEO/serve.mjs)

This means the immediately important technologies right now are:

- Node.js
- HTML
- CSS
- browser JavaScript
- Tavily
- Wikipedia fallback

The other TypeScript modules represent the broader intended search engine system.

---

## 11. What Is Partially Implemented or Prototype-Level

These are present but not fully wired into the current local runtime:

- Express routers in `api/`
- React UI in `frontend/`
- PostgreSQL vector pipeline
- Elasticsearch/OpenSearch BM25 pipeline
- Neo4j graph writing
- Cohere reranking pipeline
- Anthropic answer generation pipeline
- AWS CDK deployment stack

This is important because the repository is both:

- a working local search prototype
- a broader architecture skeleton for a more advanced system

---

## 12. Known Gaps and Practical Notes

### TypeScript status

The project has existing type-check issues around `pg` typings.

### Duplicate architecture

There are two parallel styles in the repo:

- the current local `serve.mjs` + `index.html` app
- the TypeScript modular architecture

### Suggest endpoint

The current runtime exposes `/api/suggest` through `backend/api/suggest.py`.

### PageRank scoring

The Python backend calculates PageRank over stored page links and applies it as a ranking boost.

### Local caching behavior

The current runtime uses Redis for trending queries, suggestions, and crawl frontier state.

---

## 13. Recommended Reading Order

If you are new to this project, read files in this order:

1. [PROJECT_DOCUMENTATION.md](/G:/Quantum_SEO/PROJECT_DOCUMENTATION.md)
2. [index.html](/G:/Quantum_SEO/index.html)
3. [serve.mjs](/G:/Quantum_SEO/serve.mjs)
4. [retrieval/external-search-agent.ts](/G:/Quantum_SEO/retrieval/external-search-agent.ts)
5. [frontend/SearchBar.tsx](/G:/Quantum_SEO/frontend/SearchBar.tsx)
6. [indexer/bm25-indexer.ts](/G:/Quantum_SEO/indexer/bm25-indexer.ts)
7. [retrieval/vector-retriever.ts](/G:/Quantum_SEO/retrieval/vector-retriever.ts)
8. [ranking/rrf-fusion.ts](/G:/Quantum_SEO/ranking/rrf-fusion.ts)
9. [ai/answer-generator.ts](/G:/Quantum_SEO/ai/answer-generator.ts)
10. [infrastructure/search-stack.ts](/G:/Quantum_SEO/infrastructure/search-stack.ts)

---

## 14. Final Summary

This project is a hybrid search-engine codebase with two identities:

1. A currently runnable local AI search page driven by `index.html` and `serve.mjs`
2. A larger planned architecture for a more advanced production-grade search engine

The main ideas inside the repository are:

- crawl pages
- extract text and links
- index them
- retrieve them with multiple methods
- rank them intelligently
- generate AI answers from the best results

If you want the next step, the most useful follow-ups are:

- a sequence diagram for the full flow
- a table version of every file and dependency
- an `ARCHITECTURE.md` split by backend/frontend/infrastructure
- inline comments added directly into the codebase
