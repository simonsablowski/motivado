import re, json, sys

BS = chr(92)
ESC = {'n': '\n', 'r': '\r', 't': '\t', '0': '\0', 'Z': '\x1a'}


def parse_values(s):
    rows = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] != '(':
            i += 1
            continue
        i += 1
        row = []
        while True:
            if s[i] == "'":
                j = i + 1
                buf = []
                while True:
                    c = s[j]
                    if c == BS:
                        buf.append(ESC.get(s[j + 1], s[j + 1]))
                        j += 2
                    elif c == "'":
                        if s[j + 1:j + 2] == "'":
                            buf.append("'")
                            j += 2
                        else:
                            break
                    else:
                        buf.append(c)
                        j += 1
                row.append(''.join(buf))
                i = j + 1
            else:
                j = i
                while s[j] not in ',)':
                    j += 1
                v = s[i:j]
                if v == 'NULL':
                    row.append(None)
                elif re.fullmatch(r'-?\d+', v):
                    row.append(int(v))
                elif re.fullmatch(r'-?\d+\.\d+', v):
                    row.append(float(v))
                else:
                    row.append(v)
                i = j
            if s[i] == ',':
                i += 1
                continue
            if s[i] == ')':
                i += 1
                break
        rows.append(row)
    return rows


def parse_inserts(path, tables):
    txt = open(path, encoding='utf-8', errors='replace').read()
    cols, out = {}, {}
    for t in tables:
        m = re.search(r'CREATE TABLE `%s` \((.*?)\n\) ENGINE' % t, txt, re.S)
        cols[t] = re.findall(r'^\s*`(\w+)`', m.group(1), re.M)
        rows = []
        for im in re.finditer(r'INSERT INTO `%s` VALUES (.*?);\n' % t, txt, re.S):
            rows += parse_values(im.group(1))
        out[t] = [dict(zip(cols[t], r)) for r in rows]
    return cols, out


if __name__ == '__main__':
    path, outpath = sys.argv[1], sys.argv[2]
    tables = sys.argv[3:]
    cols, out = parse_inserts(path, tables)
    json.dump(out, open(outpath, 'w', encoding='utf-8'), ensure_ascii=False)
    for t in tables:
        print(t, len(out[t]), cols[t])
