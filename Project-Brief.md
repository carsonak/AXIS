# AXIS — Agricultural Excellence in Irrigation Schemes

> This is the original product brief. For the current implementation and verification state, start with [`README.md`](README.md) and [`docs/TEAM-HANDOFF.md`](docs/TEAM-HANDOFF.md).

## Smart Irrigation Advisory for Smallholder Farmers

## In one sentence

We are building an **offline-friendly farming assistant that tells a farmer how much water their crop needs today**, using information about their farm, crop and upcoming weather.

> **Implementation status:** The deterministic engine, API, offline-oriented PWA, local history, rolling Kijani integration, refresh controls, and fallback paths are implemented. Automated, live-payload, container, and isolated development-deployment evidence is recorded separately from outstanding production and physical-device acceptance. AI and sensor adjustment remain safely gated.

---

## The problem

For many smallholder farmers, irrigation is still largely based on experience, fixed schedules or guesswork.

A farmer may know that a crop needs water, but answering the more useful questions is much harder:

> **How much water does this particular crop need today?**

> **Should I irrigate now if rain is expected tomorrow?**

> **How long should I run my pump or irrigation system?**

Using too little water can stress crops and reduce yields. Using too much wastes a scarce resource, increases pumping costs and can also harm crops.

Changing weather patterns make traditional irrigation schedules even less reliable.

At the same time, simply giving a farmer a weather forecast does not completely solve the problem. The farmer still has to translate rainfall, temperature and crop conditions into an irrigation decision.

That is the gap this project addresses.

The challenge is especially relevant to Kenya, where the hackathon's Smart Irrigation track highlights water wastage, changing weather patterns and limited access to actionable irrigation information as challenges facing smallholder farmers.

---

# Our solution

Instead of showing farmers more data, our application turns available information into a **specific action**.

A farmer tells the application a few things about their field:

- what crop they are growing;
- how old the crop is or its current growth stage;
- how large the plot is;
- where the farm is located;
- what irrigation method they use;
- and, where available, how quickly their irrigation system delivers water.

The application combines this information with weather data and calculates how much irrigation the crop currently requires.

The result should look more like:

> **Your tomato plot needs approximately 2,100 litres of water today. Rain is expected soon, so today's irrigation requirement has been reduced.**

And if the farmer knows the flow rate of their irrigation system:

> **Irrigate for approximately 47 minutes.**

The goal is to transform:

**weather + agricultural data**

into:

**a simple farming decision.**

---

# Why this is useful

There are already platforms that provide farmers with weather forecasts and agricultural information.

Our project focuses on the next step:

> **Turning that information into a field-specific irrigation recommendation.**

Research into Kenya's irrigation landscape suggests that one of the important remaining gaps is exactly this decision layer: converting weather, crop stage and field information into an actionable recommendation such as litres of water or irrigation time. It also suggests that requiring a dedicated sensor for every small farm can make otherwise useful systems harder to scale.

That is why our system is designed to work **without requiring expensive hardware**.

Sensors can improve the system later, but they are not a prerequisite for receiving useful advice.

---

# Who is it for?

Our primary users are **smallholder and small commercial farmers who already have access to some form of irrigation**.

The first version is particularly suited to crops where irrigation timing and consistency have a significant effect on productivity, such as vegetables and other higher-value irrigated crops.

We are intentionally not claiming that one prototype can perfectly support every crop and farming system in Kenya.

Instead, the idea is to start with a smaller set of crops, make those recommendations credible, and expand gradually.

---

# What happens when there is no internet?

Connectivity should not determine whether a farmer can use the application.

The project is being designed as an **offline-first Progressive Web App**, meaning it can behave much like an installed mobile application while still being delivered through the web.

After the application has been loaded, important information such as:

- the farmer's plot details;
- crop information;
- recent weather information;
- and the latest irrigation recommendation

can remain available on the device.

If the internet connection disappears, the farmer should still be able to see their latest recommendation and record irrigation activity.

When connectivity returns, the application refreshes its weather and recommendation. Farmer plots and irrigation records remain on the device in the hackathon version; there is no cloud account or hidden synchronization dependency.

This is particularly important because the intended users may operate in areas with slow, intermittent or expensive mobile data.

Offline functionality also directly supports one of the hackathon's stated areas of interest for Track 2 and can qualify for additional judging credit where relevant.
---

# How does the recommendation work?

The important part of the system is not an AI guessing how much water a crop needs.

The core recommendation is based on **explainable agricultural calculations**.

At a simplified level, the system considers:

**Weather conditions**

↓

**Estimated water lost by the crop and environment**

↓

**Crop type and growth stage**

↓

**Expected rainfall**

↓

**Plot size**

↓

**Efficiency of the farmer's irrigation method**

↓

**Recommended irrigation volume**

The result is converted into something practical such as **litres of water**.

If the irrigation system's flow rate is known, those litres can then be converted into **minutes of irrigation**.

The intention is for the recommendation to remain explainable.

A farmer—or a judge—should be able to ask:

> “Why did the app recommend this amount?”

and receive an understandable answer rather than:

> “Because an AI model said so.”

---

# Where does the weather information come from?

The project uses weather information from the **KijaniSpace weather API**.

Weather data allows the system to adjust recommendations to current conditions rather than relying entirely on a fixed irrigation calendar.

For example, if meaningful rainfall is expected, the application can reduce the amount of irrigation it recommends.

The weather provider is kept separate from the main calculation engine so that the system is not permanently dependent on one external service.

Weather information can also be cached, allowing the application to degrade gracefully if connectivity or the external API is temporarily unavailable.

---

# Where does AI fit?

AI is deliberately **not responsible for the core irrigation calculation**.

The agricultural recommendation should remain deterministic, testable and explainable.

AI can instead be used where it adds value to communication.

For example, it could eventually:

- explain recommendations in simpler language;
- translate advice into Kiswahili or other local languages;
- let a farmer ask questions conversationally;
- summarize why today's recommendation changed;
- help identify unusual irrigation patterns.

This allows AI to improve accessibility without making a critical farming decision dependent on a black-box model.

---

# Technical overview

For developers interested in how the system works, the project has three main layers.

### Farmer application

A mobile-first Progressive Web App handles:

- farm and plot setup;
- crop information;
- irrigation settings;
- recommendations;
- offline storage;
- irrigation history;
- synchronization.

### Backend

A lightweight backend written in **Go** provides:

- application APIs;
- weather integration;
- recommendation orchestration;
- optional, feature-flagged AI explanations.

The backend is stateless. Persistent plot, recommendation, irrigation-history and insight data lives in IndexedDB on the farmer's device.

The architecture intentionally avoids microservices and unnecessary infrastructure because simplicity improves both reliability and maintainability.

### Irrigation recommendation engine

The engine converts agricultural and weather data into the recommended irrigation amount.

Conceptually:

`crop + growth stage + weather + rainfall + plot area + irrigation efficiency`

becomes:

`recommended water volume`

and optionally:

`recommended irrigation duration`

The calculation engine is intentionally separate from the user interface and weather provider so that each can evolve independently.

---

# Sensor optional, not sensor dependent

A major long-term design principle is:

> **Model first. Sensor optional.**

Many smart-irrigation systems begin by installing a soil-moisture sensor on every farm.

That can work technically, but sensors introduce cost, maintenance, calibration, power and connectivity requirements.

Our approach aims to provide useful recommendations using information farmers can already provide together with weather data.

Later, soil-moisture sensors can be added to improve or calibrate recommendations.

AXIS already defines a typed sensor seam for timestamped soil-humidity readings together with field-capacity, wilting-point and root-zone calibration. Raw or stale sensor percentages never silently alter the irrigation amount: the adjustment remains gated until the calibration and agronomic model are valid.

Water-flow meters are supported today through manually entered cumulative start and end readings, and AXIS stores their difference as the measured water actually applied. Automatic device ingestion requires a future hardware adapter. Manual and recommendation-based logging remain available when no meter exists.

This opens the possibility of one sensor being shared across several similar farms rather than requiring every farmer to purchase new hardware. This sensor-optional approach is one of the stronger opportunities identified in the research into Kenya's irrigation technology landscape.

---

# What makes the project different?

The project is built around four ideas.

**Action instead of information.**
We do not simply tell a farmer the temperature or chance of rain. We try to answer what they should actually do with that information.

**Specific instead of generic.**
The recommendation depends on the farmer's crop, growth stage, plot and irrigation method.

**Offline instead of connectivity-dependent.**
Poor internet should reduce freshness, not make the entire application unusable.

**Explainable instead of black-box.**
The farmer should be able to understand why a recommendation was made.

---

# The bigger opportunity

The first version answers one question:

> **How much should I irrigate today?**

But the same foundation can eventually support a much larger irrigation-management system.

Future versions could incorporate:

- soil-moisture sensors;
- pump and flow monitoring;
- automatic irrigation records;
- water-use analytics;
- abnormal pump or leak detection;
- extension-worker dashboards;
- shared community irrigation systems;
- water budgeting;
- farmer feedback and local model calibration.

Over time, the application could help connect:

**weather → crop needs → irrigation decision → actual water used → crop outcome**

That creates useful information not just for farmers, but potentially for extension workers, cooperatives, irrigation schemes and agricultural programs.

---

# Why it matters

Water is one of agriculture's most important and increasingly constrained resources.

The opportunity is therefore not simply to help farmers irrigate more.

It is to help them irrigate **more intelligently**.

If a farmer can produce the same or better crop using less unnecessary irrigation, there are potential benefits on several levels:

- less water wasted;
- lower pumping and energy costs;
- improved resilience during dry periods;
- better-informed farming decisions;
- and potentially more reliable crop production.

For a smallholder farmer, the value of the product ultimately comes down to a very simple promise:

> **Before you turn on the water, know approximately how much your crop actually needs.**

---

# 30-second explanation

We are building a smart irrigation assistant for smallholder farmers. Instead of simply showing farmers a weather forecast, the application combines weather with their crop, crop age, farm size and irrigation method to calculate how much water their field needs that day. It gives the answer in practical terms such as litres or irrigation minutes, and it is designed to continue working when internet connectivity is poor. The core calculation is transparent agricultural logic rather than black-box AI, while sensors and AI can later improve the system without being required for it to work.

---

# The idea in one flow

**Farmer describes the field**

↓

**Application checks the weather**

↓

**System estimates the crop's water requirement**

↓

**Expected rainfall is accounted for**

↓

**The requirement is adjusted for the irrigation method**

↓

### **“Apply approximately 2,100 litres today.”**

↓

**Recommendation remains available offline**

↓

**Farmer records what they actually irrigated**

↓

**The system builds a history of water use and recommendations**
