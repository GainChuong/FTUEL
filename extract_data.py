import pandas as pd
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    df = pd.read_excel('data-crawl.xlsx')
    
    vn_mapping = {
        'Tên Shop': 'shop_name',
        'Tên sản phẩm': 'name',
        'Rating': 'rating',
        'Giá': 'price',
        'Đã bán': 'sold_count',
        'Vùng': 'region',
        'Khuyến mại': 'promotion'
    }
    
    final_data = []
    user_id = "fef1c771-6b4c-4e3e-926e-37875dccd23e"
    
    for _, row in df.iterrows():
        shop_raw = str(row.get('Tên Shop', '')).lower()
        name_raw = str(row.get('Tên sản phẩm', '')).lower()
        
        assigned_shop = None
        if 'nesty' in shop_raw:
            assigned_shop = 'nesty'
        elif 'crocs' in shop_raw or 'crocs' in name_raw:
            assigned_shop = 'crocs'
        elif 'shondo' in shop_raw or 'shondo' in name_raw:
            assigned_shop = 'shondo'
            
        if not assigned_shop:
            continue
            
        item = {"user_id": user_id}
        for src, target in vn_mapping.items():
            if src in df.columns:
                val = row[src]
                if pd.isna(val):
                    val = None
                elif target == 'sold_count':
                    try:
                        s_val = str(val).lower().replace(',', '').replace('.', '')
                        if 'k' in s_val:
                            val = int(float(s_val.replace('k', '')) * 1000)
                        else:
                            val = int(float(s_val))
                    except:
                        val = 0
                elif target in ['price', 'rating', 'promotion']:
                    try:
                        s_val = str(val).replace(',', '').replace('₫', '').replace('%', '').strip()
                        val = float(s_val)
                    except:
                        val = 0.0
                item[target] = val
        
        # Override shop_name with normalized name
        item['shop_name'] = assigned_shop
        final_data.append(item)
        
    with open('data_to_import.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    print(f"SUCCESS: {len(final_data)} rows saved to data_to_import.json")

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
