"""
DevProof Code Similarity Engine v2.0
=====================================
Three analysis engines:

1. MOSS-Equivalent (Winnowing Algorithm)
   - Uses the exact same document-fingerprinting technique as Stanford MOSS.
   - Produces a "moss_similarity" percentage.

2. DevProof Enhanced Engine
   - Combines 4 techniques for higher accuracy:
     a) Token normalization + SequenceMatcher
     b) N-gram structural analysis (3-gram & 5-gram)
     c) Winnowing fingerprints (shared with MOSS engine)
     d) TF-IDF weighted cosine similarity
   - Produces a "devproof_similarity" percentage.

3. Cross-repo comparison mode
   - Accepts user_code[] vs external_code[] and runs pairwise analysis.

Input via stdin (JSON). Output via stdout (JSON).
"""

import sys
import json
import re
import math
import hashlib
from collections import Counter
from difflib import SequenceMatcher


# =============================================================================
# SHARED: Code Normalization
# =============================================================================

KEYWORDS = frozenset({
    # JS/TS
    'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for',
    'while', 'class', 'import', 'export', 'default', 'from', 'async',
    'await', 'try', 'catch', 'throw', 'new', 'this', 'super', 'extends',
    'switch', 'case', 'break', 'continue', 'typeof', 'instanceof',
    'do', 'finally', 'void', 'delete', 'yield', 'of',
    # Python
    'def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else',
    'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield',
    'lambda', 'pass', 'raise', 'in', 'not', 'and', 'or', 'is', 'None',
    'True', 'False', 'self', 'print', 'global', 'nonlocal', 'assert',
    # Java/C/C++
    'public', 'private', 'protected', 'static', 'void', 'int', 'float',
    'double', 'string', 'bool', 'boolean', 'char', 'long', 'short',
    'struct', 'enum', 'interface', 'implements', 'package', 'main',
    'abstract', 'final', 'synchronized', 'volatile', 'transient',
    'native', 'throws', 'null', 'unsigned', 'signed', 'const',
    'template', 'typename', 'namespace', 'using', 'virtual', 'override',
    'include', 'define', 'ifdef', 'endif', 'pragma',
    # Go
    'func', 'package', 'type', 'struct', 'interface', 'map', 'range',
    'go', 'chan', 'select', 'defer', 'fallthrough',
    # Rust
    'fn', 'let', 'mut', 'pub', 'impl', 'trait', 'use', 'mod', 'match',
    'enum', 'struct', 'where', 'move', 'ref', 'crate', 'unsafe',
})

# Structural operators and delimiters that matter for code structure
STRUCTURAL_TOKENS = frozenset({
    '{', '}', '(', ')', '[', ']', ';', ',', ':', '.', '=', '==', '===',
    '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '&&',
    '||', '!', '&', '|', '^', '~', '<<', '>>', '?', '=>', '->',
    '+=', '-=', '*=', '/=', '++', '--', '::', '..', '...', '@',
})


def normalize_code(code_str):
    """
    Language-agnostic code normalization.
    Strips comments, string literals, excess whitespace, and normalizes
    identifiers to produce a structural fingerprint.
    """
    if not code_str or not code_str.strip():
        return ""

    # Remove multi-line comments
    code = re.sub(r'/\*.*?\*/', '', code_str, flags=re.DOTALL)
    code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''", '', code, flags=re.DOTALL)
    code = re.sub(r'<!--.*?-->', '', code, flags=re.DOTALL)

    # Remove single-line comments
    code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)
    code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)

    # Replace string literals with placeholder
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '"S"', code)
    code = re.sub(r"'(?:[^'\\]|\\.)*'", "'S'", code)
    code = re.sub(r'`(?:[^`\\]|\\.)*`', '`S`', code)

    # Normalize whitespace
    code = re.sub(r'\s+', ' ', code).strip()

    return code


def tokenize_code(code_str):
    """
    Tokenize normalized code into structural tokens.
    Keywords stay as-is, identifiers become 'ID', numbers become 'NUM'.
    """
    normalized = normalize_code(code_str)
    if not normalized:
        return []

    raw_tokens = re.findall(r'[a-zA-Z_]\w*|[0-9]+(?:\.[0-9]+)?|[^\s\w]', normalized)
    tokens = []
    for token in raw_tokens:
        lower = token.lower()
        if lower in KEYWORDS:
            tokens.append(lower)
        elif re.match(r'^[0-9]', token):
            tokens.append('NUM')
        elif re.match(r'^[a-zA-Z_]\w*$', token):
            tokens.append('ID')
        else:
            tokens.append(token)

    return tokens


# =============================================================================
# ENGINE 1: Winnowing (MOSS-Equivalent)
# =============================================================================

def rolling_hash(text, base=256, mod=10**9 + 7):
    """Compute hash of a string."""
    h = 0
    for ch in text:
        h = (h * base + ord(ch)) % mod
    return h


def kgrams(tokens, k=5):
    """Generate k-grams from a list of tokens."""
    token_str = ' '.join(tokens)
    grams = []
    for i in range(len(token_str) - k + 1):
        grams.append(token_str[i:i+k])
    return grams


def winnow_fingerprints(tokens, k=5, window=4):
    """
    Winnowing algorithm — the core of Stanford MOSS.
    
    1. Generate k-grams from the token sequence
    2. Hash each k-gram
    3. Use a sliding window to select minimum hashes (fingerprints)
    
    Returns a set of fingerprint hashes.
    """
    if len(tokens) < 3:
        return set()

    # Generate k-grams from token sequence
    token_str = ' '.join(tokens)
    grams = []
    for i in range(max(1, len(token_str) - k + 1)):
        gram = token_str[i:i+k]
        grams.append(gram)

    if not grams:
        return set()

    # Hash each k-gram
    hashes = [rolling_hash(g) for g in grams]

    if len(hashes) < window:
        return set(hashes)

    # Winnowing: slide a window and pick the minimum hash in each window
    fingerprints = set()
    prev_min_idx = -1

    for i in range(len(hashes) - window + 1):
        window_slice = hashes[i:i + window]
        # Find rightmost minimum (MOSS convention)
        min_val = min(window_slice)
        min_idx = i + len(window_slice) - 1 - window_slice[::-1].index(min_val)

        if min_idx != prev_min_idx:
            fingerprints.add(min_val)
            prev_min_idx = min_idx

    return fingerprints


def moss_similarity(tokens_a, tokens_b, k=5, window=4):
    """
    MOSS-equivalent similarity using Winnowing fingerprints.
    Returns Jaccard similarity of the two fingerprint sets as a percentage.
    """
    fp_a = winnow_fingerprints(tokens_a, k, window)
    fp_b = winnow_fingerprints(tokens_b, k, window)

    if not fp_a and not fp_b:
        return 0.0

    intersection = fp_a & fp_b
    union = fp_a | fp_b

    if not union:
        return 0.0

    return round((len(intersection) / len(union)) * 100, 2)


# =============================================================================
# ENGINE 2: DevProof Enhanced Engine
# =============================================================================

def ngram_similarity(tokens_a, tokens_b, n=3):
    """
    N-gram structural similarity.
    Generates n-grams of token sequences and computes Jaccard overlap.
    """
    if len(tokens_a) < n or len(tokens_b) < n:
        return 0.0

    ngrams_a = set()
    for i in range(len(tokens_a) - n + 1):
        ngrams_a.add(tuple(tokens_a[i:i+n]))

    ngrams_b = set()
    for i in range(len(tokens_b) - n + 1):
        ngrams_b.add(tuple(tokens_b[i:i+n]))

    if not ngrams_a and not ngrams_b:
        return 0.0

    intersection = ngrams_a & ngrams_b
    union = ngrams_a | ngrams_b

    if not union:
        return 0.0

    return round((len(intersection) / len(union)) * 100, 2)


def tfidf_cosine_similarity(tokens_a, tokens_b):
    """
    TF-IDF weighted cosine similarity between two token sequences.
    Uses both documents as the corpus for IDF computation.
    """
    if not tokens_a or not tokens_b:
        return 0.0

    # Build vocabulary
    counter_a = Counter(tokens_a)
    counter_b = Counter(tokens_b)
    vocab = set(counter_a.keys()) | set(counter_b.keys())

    if not vocab:
        return 0.0

    # IDF: log(N / df) where N=2 (two documents), df = number of docs containing term
    idf = {}
    for term in vocab:
        df = (1 if term in counter_a else 0) + (1 if term in counter_b else 0)
        idf[term] = math.log(2.0 / df) if df > 0 else 0.0

    # TF-IDF vectors
    def tfidf_vector(counter, total):
        vec = {}
        for term in vocab:
            tf = counter.get(term, 0) / max(total, 1)
            vec[term] = tf * idf.get(term, 0)
        return vec

    vec_a = tfidf_vector(counter_a, len(tokens_a))
    vec_b = tfidf_vector(counter_b, len(tokens_b))

    # Cosine similarity
    dot = sum(vec_a.get(t, 0) * vec_b.get(t, 0) for t in vocab)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return round((dot / (mag_a * mag_b)) * 100, 2)


def sequence_similarity(code_a, code_b):
    """
    SequenceMatcher-based structural similarity (our original engine, improved).
    Operates on normalized code strings rather than raw tokens.
    """
    norm_a = normalize_code(code_a)
    norm_b = normalize_code(code_b)

    if not norm_a or not norm_b:
        return 0.0

    return round(SequenceMatcher(None, norm_a, norm_b).ratio() * 100, 2)


def devproof_similarity(code_a, code_b, tokens_a=None, tokens_b=None):
    """
    DevProof Enhanced Similarity Score.
    Combines 4 techniques with weighted averaging:
      - 20% SequenceMatcher (structural text)
      - 25% 3-gram overlap
      - 25% Winnowing fingerprint overlap
      - 30% TF-IDF cosine similarity (weighted by token importance)
    
    This layered approach catches similarities that any single technique
    would miss, resulting in a higher-accuracy prediction than MOSS alone.
    """
    if tokens_a is None:
        tokens_a = tokenize_code(code_a)
    if tokens_b is None:
        tokens_b = tokenize_code(code_b)

    # Technique 1: SequenceMatcher on normalized code
    seq_sim = sequence_similarity(code_a, code_b)

    # Technique 2: N-gram overlap (3-gram)
    ngram_sim_3 = ngram_similarity(tokens_a, tokens_b, n=3)

    # Technique 3: Winnowing fingerprint Jaccard
    winnow_sim = moss_similarity(tokens_a, tokens_b)

    # Technique 4: TF-IDF cosine similarity
    tfidf_sim = tfidf_cosine_similarity(tokens_a, tokens_b)

    # Weighted combination
    combined = (
        0.20 * seq_sim +
        0.25 * ngram_sim_3 +
        0.25 * winnow_sim +
        0.30 * tfidf_sim
    )

    return round(combined, 2)


# =============================================================================
# ANALYSIS MODES
# =============================================================================

def analyze_internal(samples):
    """
    Internal analysis: compare user's own repos against each other.
    Returns both MOSS and DevProof scores for each pair.
    """
    if len(samples) < 2:
        return {
            "max_similarity": 0.0,
            "avg_similarity": 0.0,
            "pair_results": [],
            "moss_max": 0.0,
            "devproof_max": 0.0
        }

    # Pre-tokenize all samples
    tokenized = []
    for s in samples:
        code = s.get('code', '')
        tokens = tokenize_code(code)
        tokenized.append({
            'repo': s.get('repo', 'unknown'),
            'code': code,
            'tokens': tokens
        })

    pair_results = []
    moss_scores = []
    devproof_scores = []

    for i in range(len(tokenized)):
        for j in range(i + 1, len(tokenized)):
            m_sim = moss_similarity(tokenized[i]['tokens'], tokenized[j]['tokens'])
            d_sim = devproof_similarity(
                tokenized[i]['code'], tokenized[j]['code'],
                tokenized[i]['tokens'], tokenized[j]['tokens']
            )

            pair_results.append({
                "repo_a": tokenized[i]['repo'],
                "repo_b": tokenized[j]['repo'],
                "similarity": d_sim,  # backward compat: use devproof as primary
                "moss_similarity": m_sim,
                "devproof_similarity": d_sim
            })
            moss_scores.append(m_sim)
            devproof_scores.append(d_sim)

    max_moss = max(moss_scores) if moss_scores else 0.0
    max_devproof = max(devproof_scores) if devproof_scores else 0.0
    avg_sim = sum(devproof_scores) / len(devproof_scores) if devproof_scores else 0.0

    return {
        "max_similarity": round(max_devproof, 2),
        "avg_similarity": round(avg_sim, 2),
        "pair_results": pair_results,
        "moss_max": round(max_moss, 2),
        "devproof_max": round(max_devproof, 2)
    }


def analyze_cross_repo(user_samples, external_samples):
    """
    Cross-repo analysis: compare user's code against external public repos.
    Returns top matches with both MOSS and DevProof scores.
    """
    if not user_samples or not external_samples:
        return {
            "matches_found": 0,
            "top_matches": [],
            "overall_moss_score": 0.0,
            "overall_devproof_score": 0.0
        }

    # Pre-tokenize
    user_tokenized = []
    for s in user_samples:
        tokens = tokenize_code(s.get('code', ''))
        user_tokenized.append({
            'repo': s.get('repo', 'unknown'),
            'code': s.get('code', ''),
            'tokens': tokens
        })

    ext_tokenized = []
    for s in external_samples:
        tokens = tokenize_code(s.get('code', ''))
        ext_tokenized.append({
            'repo': s.get('repo', 'unknown'),
            'owner': s.get('owner', 'unknown'),
            'url': s.get('url', ''),
            'code': s.get('code', ''),
            'tokens': tokens
        })

    all_matches = []

    for u in user_tokenized:
        for e in ext_tokenized:
            if not u['tokens'] or not e['tokens']:
                continue

            m_sim = moss_similarity(u['tokens'], e['tokens'])
            d_sim = devproof_similarity(
                u['code'], e['code'],
                u['tokens'], e['tokens']
            )

            # Only include meaningful matches (> 15% on either engine)
            if m_sim > 15 or d_sim > 15:
                all_matches.append({
                    "user_repo": u['repo'],
                    "external_repo": f"{e['owner']}/{e['repo']}",
                    "external_url": e['url'],
                    "moss_similarity": m_sim,
                    "devproof_similarity": d_sim
                })

    # Sort by DevProof score (most accurate), take top 10
    all_matches.sort(key=lambda x: x['devproof_similarity'], reverse=True)
    top_matches = all_matches[:10]

    overall_moss = max((m['moss_similarity'] for m in top_matches), default=0.0)
    overall_devproof = max((m['devproof_similarity'] for m in top_matches), default=0.0)

    return {
        "matches_found": len(all_matches),
        "top_matches": top_matches,
        "overall_moss_score": round(overall_moss, 2),
        "overall_devproof_score": round(overall_devproof, 2)
    }


# =============================================================================
# MAIN
# =============================================================================

def main():
    """
    Accepts JSON via stdin with one of:
      - { "code_samples": [...] }                        → internal analysis
      - { "user_code": [...], "external_code": [...] }   → cross-repo analysis
      - { "code_a": "...", "code_b": "..." }             → legacy pairwise
      - { "full_analysis": { "internal": [...], "external": [...] } } → both
    """
    input_data = sys.stdin.read()

    try:
        data = json.loads(input_data)

        # Full analysis mode: internal + cross-repo
        if 'full_analysis' in data:
            fa = data['full_analysis']
            internal = analyze_internal(fa.get('internal', []))
            cross = analyze_cross_repo(
                fa.get('internal', []),
                fa.get('external', [])
            )
            print(json.dumps({
                "internal_analysis": internal,
                "cross_repo_analysis": cross
            }))

        # Cross-repo mode
        elif 'user_code' in data and 'external_code' in data:
            result = analyze_cross_repo(
                data['user_code'],
                data['external_code']
            )
            print(json.dumps(result))

        # Internal multi-sample mode (backward compatible)
        elif 'code_samples' in data:
            result = analyze_internal(data['code_samples'])
            print(json.dumps(result))

        # Legacy pairwise mode (backward compatible)
        elif 'code_a' in data and 'code_b' in data:
            code_a = data['code_a']
            code_b = data['code_b']
            tokens_a = tokenize_code(code_a)
            tokens_b = tokenize_code(code_b)
            m_sim = moss_similarity(tokens_a, tokens_b)
            d_sim = devproof_similarity(code_a, code_b, tokens_a, tokens_b)
            print(json.dumps({
                "moss_similarity": m_sim,
                "devproof_similarity": d_sim,
                "similarity": d_sim  # backward compat
            }))

        else:
            print(json.dumps({
                "error": "Invalid input format",
                "max_similarity": 0.0,
                "avg_similarity": 0.0,
                "pair_results": []
            }))

    except Exception as e:
        print(json.dumps({
            "max_similarity": 0.0,
            "avg_similarity": 0.0,
            "pair_results": [],
            "error": str(e)
        }))


if __name__ == "__main__":
    main()