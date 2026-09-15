# Episode selection

Use this before researching a new **Systems from First Principles** episode. A topic must pass every gate, then earn its place on the weighted score.

## Gates

A topic that fails any gate is rejected, regardless of score.

1. **First-party evidence exists.** At least two dated first-party engineering posts or talks describe how the system works, and ideally why it changed. Without them, most levels become speculation.
2. **The problem is visible in ten seconds.** A cold open can show what goes wrong for a real user before any technology is named.
3. **The simple design fails honestly.** At least two failures can be demonstrated, so the episode is an evolution rather than a tour of a finished architecture.

## Weighted score

Score each criterion from 0 to 5, then compute `weight × score ÷ 5`. The maximum total is 100.

| Criterion | Weight | 1 — weak | 3 — solid | 5 — excellent |
| --- | ---: | --- | --- | --- |
| **Evolution depth** | 30% | One or two fixes, mostly asserted rather than forced | Four or more levels, each motivated by the previous failure | Four to eight levels, with failures the company documented itself |
| **Transferable lesson** | 20% | Specific to one company's stack | Teaches a known pattern in context | Teaches patterns engineers reuse widely and meet in system-design interviews |
| **Curiosity hook** | 15% | Title needs the architecture to make sense | Clear question about a familiar product | A question viewers want answered before clicking, about something they use |
| **Visual explainability** | 15% | Mostly boxes and labels | Some state changes can be animated | Every level is a visible event: packets, cursors, stale copies, crashes |
| **Distinctness** | 10% | Widely covered, or reteaches a previous episode | Covered elsewhere but with a clearly different angle | Rarely explained well and adds new concepts to the series |
| **Relevance** | 10% | Design since replaced, or sources more than about eight years old with no update | Still broadly in use; sources a few years old | Current production design with recent sources, solving a problem engineers face today |

### Decision rule

- **Proceed:** passes all gates, scores **70 or higher**, and no criterion scores below 2.
- **Park:** passes all gates but misses the threshold. Record why; better sources or a sharper angle may revive it.
- **Reject:** fails a gate.

## Tiebreakers and warnings

- **News hype** breaks ties only. Relevance asks whether the design is current; hype asks whether it is trending this week. A long-form episode should still be worth watching in two years.
- **Company fame** is not a criterion. A lesser-known company with a documented failure beats a famous one with thin sources.
- **Scope:** if the honest story needs more than about eight levels, split it or narrow the central question. Figma multiplayer used eight levels in 12–14 minutes.
- **The common trap:** many engineering posts describe only the final system. Documented failures are the rarest ingredient, which is why evolution depth carries the most weight.

## Approval

Track scored ideas in [episode candidates](episode-candidates.md). Record every serious candidate with the [topic brief template](../templates/topic-brief-template.md) and get explicit approval before starting research. Approved briefs live at `episodes/<slug>/research/topic-brief.md`.
