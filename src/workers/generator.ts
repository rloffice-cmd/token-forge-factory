/**
 * Generator Worker
 * Creates solution.py with extract_iso_dates function
 * Following strict policy rules for ISO-8601 date extraction
 */

import type { Task, GeneratorOutput } from '@/types';

// Template for the solution code
const SOLUTION_TEMPLATE = `"""
Date Extraction Forensic Auditor
Extract ISO-8601 dates (YYYY-MM-DD) with strict validation.

Policy:
- Extract only ISO-8601 format: YYYY-MM-DD
- Ambiguity = REJECT (return empty list)
- Invalid dates = REJECT
- Date range: {minDate} to {maxDate}
- None or empty string => []
- Output: unique list, order of appearance

Forbidden:
- No guessing dates
- No DD/MM or MM/DD interpretation
- No external libraries (only re, datetime)
"""
import re
from datetime import datetime
from typing import List

def extract_iso_dates(text: str) -> List[str]:
    """
    Extract valid ISO-8601 dates from text.
    
    Args:
        text: Input string to extract dates from
        
    Returns:
        List of unique valid dates in order of appearance
        Empty list if text is None, empty, or contains ambiguous dates
    
    Examples:
        >>> extract_iso_dates("Meeting on 2024-03-15")
        ['2024-03-15']
        
        >>> extract_iso_dates("01/02/2024")  # Ambiguous
        []
        
        >>> extract_iso_dates("2024-02-30")  # Invalid date
        []
    """
    # Handle None or empty input
    if text is None or text == "":
        return []
    
    # ISO-8601 pattern: YYYY-MM-DD with strict 4-2-2 digit format
    pattern = r'\b(\d{4})-(\d{2})-(\d{2})\b'
    matches = re.findall(pattern, text)
    
    seen = set()
    result = []
    
    for year, month, day in matches:
        date_str = f"{year}-{month}-{day}"
        
        # Skip duplicates (maintain order of first appearance)
        if date_str in seen:
            continue
            
        # Validate year range: {minDate} to {maxDate}
        year_int = int(year)
        if year_int < {minYear} or year_int > {maxYear}:
            continue
            
        # Validate that the date actually exists
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            # Invalid date (e.g., Feb 30, Month 13)
            continue
            
        seen.add(date_str)
        result.append(date_str)
    
    return result


# Self-test when run directly
if __name__ == "__main__":
    test_cases = [
        ("Meeting on 2024-03-15", ["2024-03-15"]),
        ("01/02/2024", []),  # Ambiguous - reject
        ("2024-02-30", []),  # Invalid date
        ("2024-13-01", []),  # Invalid month
        ("From 2024-01-01 to 2024-12-31", ["2024-01-01", "2024-12-31"]),
        ("", []),
        (None, []),
    ]
    
    for input_text, expected in test_cases:
        result = extract_iso_dates(input_text)
        status = "✓" if result == expected else "✗"
        print(f"{status} Input: {repr(input_text)[:40]}")
        print(f"  Expected: {expected}")
        print(f"  Got:      {result}")
`;

/**
 * Generate solution.py code based on task policy
 */
export function generateSolution(task: Task, fixNotes?: string[]): GeneratorOutput {
  try {
    const policy = task.policy_json;
    
    // Extract date range values
    const minDate = policy.date_range?.min || '1900-01-01';
    const maxDate = policy.date_range?.max || '2100-12-31';
    const minYear = parseInt(minDate.split('-')[0]);
    const maxYear = parseInt(maxDate.split('-')[0]);
    
    // Generate the code by replacing placeholders
    let code = SOLUTION_TEMPLATE
      .replace(/{minDate}/g, minDate)
      .replace(/{maxDate}/g, maxDate)
      .replace(/{minYear}/g, String(minYear))
      .replace(/{maxYear}/g, String(maxYear));
    
    // Add fix notes as comments if provided
    if (fixNotes && fixNotes.length > 0) {
      const notesSection = `
# Fix Notes from previous iteration:
${fixNotes.map(note => `# - ${note}`).join('\n')}
`;
      code = code.replace('"""', `"""${notesSection}`);
    }
    
    return {
      code,
      success: true,
    };
  } catch (error) {
    return {
      code: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown generation error',
    };
  }
}

/**
 * Validate that generated code follows policy rules
 */
export function validateGeneratedCode(code: string, task: Task): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for forbidden external imports
  const forbiddenImports = ['dateutil', 'pandas', 'numpy', 'arrow'];
  for (const imp of forbiddenImports) {
    if (code.includes(`import ${imp}`) || code.includes(`from ${imp}`)) {
      errors.push(`Forbidden import detected: ${imp}`);
    }
  }
  
  // Check that function exists
  if (!code.includes('def extract_iso_dates')) {
    errors.push('Missing function: extract_iso_dates');
  }
  
  // Check for type hints
  if (!code.includes('-> List[str]')) {
    errors.push('Missing return type hint: List[str]');
  }
  
  // Check for docstring
  if (!code.includes('"""') || code.split('"""').length < 5) {
    errors.push('Missing or incomplete docstring');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
