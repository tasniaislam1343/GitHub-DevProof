import sys
import json
import ast
import difflib

# Function to convert code into a structural tree string
def get_ast_structure(code_str):
    try:
        # Parse the code into a tree structure
        tree = ast.parse(code_str)
        # Dump it as a string (this strips out variable names/comments naturally!)
        return ast.dump(tree)
    except Exception:
        # If the code has syntax errors and won't parse, return empty
        return ""

def main():
    # Read the JSON payload sent by your Node.js server
    input_data = sys.stdin.read()
    
    try:
        data = json.loads(input_data)
        candidate_code = data.get('code_a', '')
        source_code = data.get('code_b', '')

        # Generate the trees
        ast_a = get_ast_structure(candidate_code)
        ast_b = get_ast_structure(source_code)

        if not ast_a or not ast_b:
            print(0.0)
            return

        # Compare the structures and return a percentage match
        similarity = difflib.SequenceMatcher(None, ast_a, ast_b).ratio() * 100
        
        # Print the score back to Node.js
        print(f"{similarity:.2f}")
    except Exception as e:
        print(0.0)

if __name__ == "__main__":
    main()