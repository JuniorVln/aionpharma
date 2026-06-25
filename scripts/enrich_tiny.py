#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enriquece os produtos da linha Gel Dental TartOff no Tiny ERP (API v2):
descrição, SEO e imagem (via URL pública hospedada na Vercel).

Faz read-modify-write: preserva nome/preço/unidade/origem/situação/tipo.
Rode UMA vez após o deploy (as imagens precisam estar acessíveis pela web).

Uso:
  TINY_TOKEN=...  SITE_URL=https://aionpharma.vercel.app  python scripts/enrich_tiny.py
  (--dry para apenas imprimir o payload sem enviar)
"""
import json, os, sys, urllib.parse, urllib.request

TOKEN = os.environ.get("TINY_TOKEN")
SITE_URL = os.environ.get("SITE_URL", "https://aionpharma.vercel.app").rstrip("/")
BASE = "https://api.tiny.com.br/api2"
DRY = "--dry" in sys.argv

if not TOKEN:
    sys.exit("Defina TINY_TOKEN no ambiente.")

# Descrição comum da linha TartOff
TARTOFF_DESC = (
    "O TartOff é um gel de higiene oral para cães e gatos que remove o tártaro e a "
    "placa bacteriana sem escovação forçada. Combate o mau hálito e ajuda a manter "
    "dentes e gengivas saudáveis. Basta aplicar: o gel age suavemente e o pet adora. "
    "Resultados visíveis em poucas semanas de uso contínuo. Seguro se ingerido."
)

def variante(sabor, tamanho, img):
    return {
        "descricao": f"{TARTOFF_DESC}\n\nSabor {sabor} • Frasco de {tamanho}.",
        "image": f"{SITE_URL}/assets/produtos/{img}",
        "seo_title": f"Gel Dental TartOff {sabor} {tamanho} — Removedor de Tártaro Pet",
        "seo_description": (
            f"Gel de higiene bucal sabor {sabor.lower()} que remove tártaro e placa de "
            f"cães e gatos sem escovação. Frasco de {tamanho}."
        ),
        "seo_keywords": "tartoff, gel dental pet, higiene bucal cachorro, tártaro gato, removedor de tártaro",
        "slug": f"gel-dental-tartoff-{sabor.lower()}-{tamanho.replace(' ', '').lower()}",
    }

# id Tiny -> conteúdo
CATALOGO = {
    "337732486": variante("Banana", "100ml", "gel-banana-100ml.jpg"),  # codigo 1174
    "337728706": variante("Banana", "50ml",  "gel-banana-50ml.jpg"),   # codigo 1175
    "337733722": variante("Menta",  "100ml", "gel-menta-100ml.jpg"),   # codigo 1172
    "337734424": variante("Menta",  "50ml",  "gel-menta-50ml.jpg"),    # codigo 1173
}

def call(service, **params):
    params.update(token=TOKEN, formato="json")
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/{service}.php", data=data,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))["retorno"]

def obter(pid):
    return call("produto.obter", id=pid)["produto"]

def enrich(pid, c):
    p = obter(pid)
    prod = {
        "sequencia": "1",
        "id": str(p["id"]),
        "nome": p["nome"],
        "unidade": p.get("unidade") or "UN",
        "preco": str(p.get("preco") or "0"),
        "origem": str(p.get("origem") or "0"),
        "situacao": p.get("situacao") or "A",
        "tipo": p.get("tipo") or "P",
        "descricao_complementar": c["descricao"],
        "imagens_externas": [{"imagem_externa": {"url": c["image"]}}],
        "seo": {
            "seo_title": c["seo_title"],
            "seo_description": c["seo_description"],
            "seo_keywords": c["seo_keywords"],
            "slug": c["slug"],
        },
    }
    if p.get("codigo"):
        prod["codigo"] = p["codigo"]
    payload = {"produtos": [{"produto": prod}]}
    if DRY:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    return call("produto.alterar", produto=json.dumps(payload, ensure_ascii=False))

if __name__ == "__main__":
    for pid, c in CATALOGO.items():
        r = enrich(pid, c)
        if DRY:
            continue
        ok = r and r.get("status") == "OK"
        print(f"{pid} -> {c['slug']}: {'OK' if ok else 'FALHOU'} {('' if ok else json.dumps(r, ensure_ascii=False))}")
    print("Concluído." if not DRY else "(dry-run)")
