"""
Knowledge Store & Retrieval (RAG) with Delimiter Wrapping and Anti-Poisoning Defenses.
Ingests manuals, SOPs, past maintenance history, and technician notes.
"""
import os
import re
import math
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from core.db import get_db_connection
from knowledge.sanitizer import wrap_passage_in_delimiters, sanitize_text


@dataclass
class KnowledgePassage:
    doc_id: str
    source: str
    asset_type: str
    category: str  # "SOP", "MANUAL", "PAST_INCIDENT", "TECH_NOTE"
    title: str
    content: str
    date: str
    tokens: List[str]


class KnowledgeStore:
    def __init__(self, db_path: str = "data/maintain_copilot.db", docs_dir: str = "knowledge/docs"):
        self.db_path = db_path
        self.docs_dir = docs_dir
        self.passages: List[KnowledgePassage] = []
        self._load_all()

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]

    def _load_all(self) -> None:
        self.passages.clear()
        
        # 1. Load markdown manuals and SOPs
        p_dir = Path(self.docs_dir)
        if p_dir.exists():
            for f in p_dir.iterdir():
                if f.suffix in [".md", ".txt"]:
                    raw_text = f.read_text(encoding="utf-8")
                    asset_type = "general"
                    category = "SOP" if "SOP" in f.name else "MANUAL"
                    if "MTR" in f.name or "motor" in f.name:
                        asset_type = "conveyor_motor"
                    elif "PMP" in f.name or "pump" in f.name:
                        asset_type = "centrifugal_pump"
                    elif "CMP" in f.name or "compressor" in f.name:
                        asset_type = "compressor"

                    # Split sections by '## '
                    sections = raw_text.split("## ")
                    main_title = sections[0].strip().replace("# ", "")
                    for idx, sec in enumerate(sections):
                        sec_content = ("## " + sec).strip() if idx > 0 else sec.strip()
                        if not sec_content:
                            continue
                        doc_id = f"{f.stem}_{idx}"
                        tokens = self._tokenize(sec_content)
                        self.passages.append(
                            KnowledgePassage(
                                doc_id=doc_id,
                                source=f.name,
                                asset_type=asset_type,
                                category=category,
                                title=f"{main_title} - Section {idx}",
                                content=sec_content,
                                date="2026-01-01",
                                tokens=tokens
                            )
                        )

        # 2. Ingest past maintenance history from DB
        if os.path.exists(self.db_path):
            conn = get_db_connection(self.db_path)
            cur = conn.cursor()
            cur.execute("""
                SELECT mh.*, a.asset_type 
                FROM maintenance_history mh 
                JOIN assets a ON mh.asset_id = a.id
            """)
            for r in cur.fetchall():
                text = (
                    f"Incident {r['id']} on Asset {r['asset_id']} ({r['asset_type']}). "
                    f"Failure Mode: {r['failure_mode']}. Action: {r['corrective_action']}. "
                    f"Technician Notes: {r['free_text_notes']}. Downtime: {r['downtime_hours']} hrs. "
                    f"Parts replaced: {r['parts_replaced']}."
                )
                self.passages.append(
                    KnowledgePassage(
                        doc_id=r["id"],
                        source=f"CMMS:HistoricalIncident:{r['id']}",
                        asset_type=r["asset_type"],
                        category="PAST_INCIDENT",
                        title=f"Past Resolution: {r['failure_mode']} on {r['asset_id']}",
                        content=text,
                        date=r["timestamp"][:10],
                        tokens=self._tokenize(text)
                    )
                )
            conn.close()

    def search_knowledge(
        self,
        query: str,
        asset_type: Optional[str] = None,
        k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Rank passages by BM25/cosine token match and return sanitized, wrapped data.
        """
        q_tokens = set(self._tokenize(query))
        if not q_tokens:
            return []

        scored: List[Tuple[float, KnowledgePassage]] = []
        for p in self.passages:
            # Asset filter if specified
            if asset_type and p.asset_type not in (asset_type, "general"):
                continue

            # Compute term overlap score
            overlap = sum(1 for t in q_tokens if t in p.tokens)
            if overlap == 0:
                continue

            score = overlap / (math.sqrt(len(p.tokens)) + 1.0)
            # Boost SOP & Manual procedures
            if p.category in ["SOP", "MANUAL"]:
                score *= 1.25

            scored.append((score, p))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_k = scored[:k]

        results = []
        for score, p in top_k:
            san_info = sanitize_text(p.content)
            wrapped = wrap_passage_in_delimiters(p.doc_id, p.source, p.asset_type, p.content)
            results.append({
                "doc_id": p.doc_id,
                "source": p.source,
                "asset_type": p.asset_type,
                "category": p.category,
                "title": p.title,
                "relevance_score": round(score, 3),
                "wrapped_content": wrapped,
                "raw_content": p.content,
                "is_poisoned_or_attack": san_info["is_suspicious"],
                "flagged_patterns": san_info["flagged_patterns"],
                "citation": f"[{p.source} | {p.title} (doc_id: {p.doc_id})]"
            })

        return results

    def get_similar_failures(
        self,
        current_evidence: List[str],
        asset_type: str,
        k: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Retrieve past failure incidents from historical maintenance logs matching current symptoms.
        """
        query_str = " ".join(current_evidence)
        past_incidents = [p for p in self.passages if p.category == "PAST_INCIDENT" and p.asset_type == asset_type]
        q_tokens = set(self._tokenize(query_str))

        scored = []
        for inc in past_incidents:
            overlap = sum(1 for t in q_tokens if t in inc.tokens)
            score = overlap / (math.sqrt(len(inc.tokens)) + 1.0)
            scored.append((score, inc))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, inc in scored[:k]:
            results.append({
                "incident_id": inc.doc_id,
                "source": inc.source,
                "date": inc.date,
                "title": inc.title,
                "summary": inc.content,
                "citation": f"CMMS Historic Record {inc.doc_id} ({inc.date})"
            })
        return results
