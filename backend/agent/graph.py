"""
Multi-agent LangGraph wiring.

Topology:
                     introspect
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    research_market  research_funds  research_qual    (parallel)
          └───────────────┼───────────────┘
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
            analyst               sentiment          (parallel)
               │                     │
               └──────────┬──────────┘
                           ▼
                         critic ──────┐
                           │          │ retry
                           ▼          │
                         writer  ◄────┘
                           │
                           ▼
                          END
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from agent.nodes.analyst import analyst
from agent.nodes.bear_analyst import bear_analyst
from agent.nodes.critic import critic, increment_retry, route_after_critic
from agent.nodes.introspect import introspect
from agent.nodes.researchers import (
    research_fundamentals,
    research_market,
    research_qualitative,
)
from agent.nodes.sentiment import sentiment
from agent.nodes.writer import writer
from agent.state import ResearchState


def build_graph():
    g = StateGraph(ResearchState)

    g.add_node("introspect", introspect)
    g.add_node("research_market", research_market)
    g.add_node("research_fundamentals", research_fundamentals)
    g.add_node("research_qualitative", research_qualitative)
    g.add_node("analyst", analyst)
    g.add_node("bear_analyst", bear_analyst)
    g.add_node("news_sentiment", sentiment)
    g.add_node("critic", critic)
    g.add_node("retry_analyst", increment_retry)
    g.add_node("writer", writer)

    g.set_entry_point("introspect")

    # Fan-out: introspect → 3 parallel researchers
    g.add_edge("introspect", "research_market")
    g.add_edge("introspect", "research_fundamentals")
    g.add_edge("introspect", "research_qualitative")

    # researchers → analyst, bear_analyst, news_sentiment (all parallel)
    for src in ("research_market", "research_fundamentals", "research_qualitative"):
        g.add_edge(src, "analyst")
        g.add_edge(src, "bear_analyst")
        g.add_edge(src, "news_sentiment")

    # Fan-in: all three must finish before critic
    g.add_edge("analyst", "critic")
    g.add_edge("bear_analyst", "critic")
    g.add_edge("news_sentiment", "critic")

    g.add_conditional_edges(
        "critic",
        route_after_critic,
        {"retry_analyst": "retry_analyst", "writer": "writer"},
    )
    g.add_edge("retry_analyst", "analyst")
    g.add_edge("writer", END)

    return g.compile()


agent_app = build_graph()
