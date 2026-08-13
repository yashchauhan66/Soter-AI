package ai.soterai.guard;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, dependency-free JSON reader/writer sufficient for the flat broker
 * responses the adapter consumes. It is intentionally small; it is not a
 * general-purpose JSON library. Only the shapes documented in the Local AI
 * Broker HTTP contract are relied upon.
 *
 * <p>Kept in-bundle so the scaffold has no external OSGi target-platform
 * dependency (e.g. Gson) to resolve before it can compile.</p>
 */
public final class Json {

    private Json() {
    }

    /** Serialize a single string field object: {"content":"..."}. */
    public static String object(String key, String value) {
        return "{" + quote(key) + ":" + quote(value) + "}";
    }

    /**
     * Build a flat string-valued JSON object from alternating key/value pairs.
     * Every value is quoted and escaped, so callers cannot accidentally inject
     * raw JSON through a field value.
     *
     * @throws IllegalArgumentException when the argument count is odd
     */
    public static String object(String... keysAndValues) {
        if (keysAndValues.length % 2 != 0) {
            throw new IllegalArgumentException("object() requires alternating key/value arguments");
        }
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < keysAndValues.length; i += 2) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(quote(keysAndValues[i])).append(':').append(quote(keysAndValues[i + 1]));
        }
        return sb.append('}').toString();
    }

    public static String quote(String raw) {
        StringBuilder sb = new StringBuilder(raw.length() + 2);
        sb.append('"');
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
        return sb.toString();
    }

    /** Parse a JSON document into Map/List/String/Double/Boolean/null. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String text) {
        Object value = new Parser(text).parseValue();
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return new LinkedHashMap<>();
    }

    public static String string(Map<String, Object> object, String key) {
        Object value = object.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    public static int integer(Map<String, Object> object, String key) {
        Object value = object.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    public static boolean bool(Map<String, Object> object, String key) {
        return Boolean.TRUE.equals(object.get(key));
    }

    @SuppressWarnings("unchecked")
    public static List<String> stringList(Map<String, Object> object, String key) {
        Object value = object.get(key);
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) {
                    out.add(String.valueOf(item));
                }
            }
        }
        return out;
    }

    private static final class Parser {
        private final String text;
        private int pos;

        Parser(String text) {
            this.text = text;
        }

        Object parseValue() {
            skipWhitespace();
            char c = peek();
            return switch (c) {
                case '{' -> parseObjectNode();
                case '[' -> parseArray();
                case '"' -> parseString();
                case 't', 'f' -> parseBoolean();
                case 'n' -> parseNull();
                default -> parseNumber();
            };
        }

        private Map<String, Object> parseObjectNode() {
            Map<String, Object> map = new LinkedHashMap<>();
            expect('{');
            skipWhitespace();
            if (peek() == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                char c = next();
                if (c == '}') {
                    break;
                }
                if (c != ',') {
                    throw new IllegalStateException("Expected ',' or '}' at " + pos);
                }
            }
            return map;
        }

        private List<Object> parseArray() {
            List<Object> list = new ArrayList<>();
            expect('[');
            skipWhitespace();
            if (peek() == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skipWhitespace();
                char c = next();
                if (c == ']') {
                    break;
                }
                if (c != ',') {
                    throw new IllegalStateException("Expected ',' or ']' at " + pos);
                }
            }
            return list;
        }

        private String parseString() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = next();
                if (c == '"') {
                    break;
                }
                if (c == '\\') {
                    char esc = next();
                    switch (esc) {
                        case '"' -> sb.append('"');
                        case '\\' -> sb.append('\\');
                        case '/' -> sb.append('/');
                        case 'n' -> sb.append('\n');
                        case 'r' -> sb.append('\r');
                        case 't' -> sb.append('\t');
                        case 'b' -> sb.append('\b');
                        case 'f' -> sb.append('\f');
                        case 'u' -> {
                            String hex = text.substring(pos, pos + 4);
                            pos += 4;
                            sb.append((char) Integer.parseInt(hex, 16));
                        }
                        default -> sb.append(esc);
                    }
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }

        private Object parseNumber() {
            int start = pos;
            while (pos < text.length() && "-+.eE0123456789".indexOf(text.charAt(pos)) >= 0) {
                pos++;
            }
            return Double.parseDouble(text.substring(start, pos));
        }

        private Object parseBoolean() {
            if (text.startsWith("true", pos)) {
                pos += 4;
                return Boolean.TRUE;
            }
            pos += 5;
            return Boolean.FALSE;
        }

        private Object parseNull() {
            pos += 4;
            return null;
        }

        private void skipWhitespace() {
            while (pos < text.length() && Character.isWhitespace(text.charAt(pos))) {
                pos++;
            }
        }

        private char peek() {
            return text.charAt(pos);
        }

        private char next() {
            return text.charAt(pos++);
        }

        private void expect(char c) {
            char actual = next();
            if (actual != c) {
                throw new IllegalStateException("Expected '" + c + "' but found '" + actual + "' at " + pos);
            }
        }
    }
}
