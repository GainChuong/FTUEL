import json

with open('data_to_import.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

if not data:
    print("No data to import")
    exit()

# Generate multi-row INSERT
columns = ["user_id", "shop_name", "name", "rating", "price", "sold_count", "region", "promotion"]
values_list = []

for item in data:
    vals = []
    for col in columns:
        val = item.get(col)
        if val is None:
            vals.append("NULL")
        elif isinstance(val, str):
            # Escape single quotes
            escaped = val.replace("'", "''")
            vals.append(f"'{escaped}'")
        else:
            vals.append(str(val))
    values_list.append(f"({', '.join(vals)})")

sql = f"INSERT INTO public.products ({', '.join(columns)}) VALUES\n" + ",\n".join(values_list) + ";"

with open('import_data.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("SUCCESS: import_data.sql generated")
