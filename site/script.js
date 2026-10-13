// Proteção contra clickjacking (o GitHub Pages não permite o cabeçalho X-Frame-Options)
if (window.top !== window.self) document.documentElement.remove();

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ---------- Título: entra palavra por palavra ---------- */
const titulo = $("#titulo");
titulo.innerHTML = titulo.textContent
  .split(" ")
  .map(
    (palavra, i) =>
      `<span class="word"><span style="--i:${i}">${palavra}</span></span>`,
  )
  .join(" ");

/* ---------- Faixa de carros: duplica para rodar sem emendas ---------- */
$("#faixa").innerHTML += $("#faixa").innerHTML;

/* ---------- Animação ao rolar (para baixo e para cima) ---------- */
// Filhos de [data-st] entram um depois do outro
$$("[data-st]").forEach((caixa) =>
  [...caixa.children].forEach((el, i) => {
    el.classList.add("rv");
    el.style.setProperty("--delay", i * 0.12 + "s");
  }),
);

function contar(el) {
  const fim = +el.dataset.to,
    inicio = performance.now();
  (function passo(agora) {
    const t = Math.min((agora - inicio) / 1600, 1);
    el.textContent = Math.round(fim * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(passo);
  })(inicio);
}

// Ao entrar na tela o elemento aparece; ao sair, volta ao estado inicial
// vindo do lado por onde saiu, então a animação se repete nos dois sentidos.
const observador = new IntersectionObserver(
  (entradas) => {
    entradas.forEach(({ target, isIntersecting, boundingClientRect }) => {
      if (isIntersecting) {
        target.classList.add("in");
        target.querySelectorAll("[data-to]").forEach(contar);
      } else {
        target.classList.remove("in");
        target.style.setProperty(
          "--y",
          boundingClientRect.top < 0 ? "-48px" : "48px",
        );
      }
    });
  },
  { threshold: 0.15 },
);
$$(".rv").forEach((el) => observador.observe(el));

/* ---------- Eventos ---------- */
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
// Data de hoje no horário do usuário (toISOString usaria o horário de Londres e erraria o dia à noite)
const dataDeHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const seguro = (texto) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); // evita HTML dentro dos textos

async function mostrarEventos() {
  const lista = $("#eventos-lista");
  if (!lista.children.length)
    lista.innerHTML = '<div class="skeleton"></div>'.repeat(3); // carregando
  const r = await rest("eventos?select=*&order=data.asc,hora.asc");
  const todos = r.dados || [],
    hoje = dataDeHoje();
  const proximos = todos.filter((e) => e.data >= hoje);

  $("#eventos-lista").innerHTML = !r.ok
    ? '<p class="lead">Não foi possível carregar os eventos.</p>'
    : proximos.length
      ? proximos
          .map(
            (e, i) => `
        <article class="card pop" style="--delay:${i * 0.08}s">
          <div class="when">${e.data.slice(8)} ${MESES[+e.data.slice(5, 7) - 1]}<small>${seguro(e.hora)}</small><small>${seguro(e.local)}</small></div>
          <h4>${seguro(e.titulo)}</h4>
          <p>${seguro(e.descricao)}</p>
        </article>`,
          )
          .join("")
      : '<p class="lead">Nenhum evento agendado por enquanto.</p>';

  listarEventosAdmin(todos); // a lista da área dos presidentes
}
mostrarEventos();

/* ---------- Mostra uma mensagem de sucesso com animação ---------- */
function avisar(caixa, mensagem) {
  caixa.textContent = mensagem;
  caixa.classList.remove("show");
  void caixa.offsetWidth; // reinicia a animação
  caixa.classList.add("show");
}

/* ---------- Formulário de inscrição ---------- */
const form = $("#form"),
  erro = $("#erro"),
  sucesso = $("#sucesso");

function cpfValido(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += cpf[i] * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return digito(9) === +cpf[9] && digito(10) === +cpf[10];
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const ano = +d.ano;
  erro.textContent = "";

  if (
    ["nome", "cpf", "nascimento", "email", "tel", "carro", "ano"].some(
      (campo) => !d[campo].trim(),
    )
  )
    return (erro.textContent = "Preencha todos os campos para continuar.");
  if (!cpfValido(d.cpf))
    return (erro.textContent = "CPF inválido. Confira os números.");
  if (!/^\S+@\S+\.\S+$/.test(d.email))
    return (erro.textContent = "Digite um e-mail válido, como nome@email.com.");
  if (!(ano >= 1886 && ano <= new Date().getFullYear()))
    return (erro.textContent =
      "Digite o ano de fabricação com 4 números, como 1969.");
  if (!d.aceite)
    return (erro.textContent =
      "Aceite a política de privacidade para enviar o cadastro.");

  const botao = form.querySelector("button");
  botao.disabled = true; // evita cliques repetidos
  const r = await enviarCadastro({ ...d, aceite: true });
  botao.disabled = false;

  if (!r.ok)
    return (erro.textContent =
      r.status === 429
        ? "Muitas tentativas. Tente novamente mais tarde."
        : r.erro || "Não foi possível enviar. Tente novamente.");
  avisar(
    sucesso,
    `Recebemos o seu cadastro, ${d.nome.split(" ")[0]}! Os presidentes vão analisar e você receberá a resposta por e-mail.`,
  );
  form.reset();
});

/* ---------- Área dos presidentes: login ---------- */
const formLogin = $("#form-login"),
  erroLogin = $("#erro-login");

async function estaLogado() {
  return !!(await tokenAtual()) && (await souPresidente());
}

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroLogin.textContent = "";
  const d = Object.fromEntries(new FormData(formLogin));
  const r = await entrar(d.email.trim(), d.senha);

  if (r.status === 429)
    return (erroLogin.textContent =
      "Muitas tentativas. Aguarde alguns minutos.");
  if (!r.ok) return (erroLogin.textContent = "E-mail ou senha incorretos.");
  if (!(await souPresidente())) {
    await sair();
    return (erroLogin.textContent =
      "Esta conta não tem permissão de presidente.");
  }
  formLogin.reset();
  location.hash = "#publicar-evento";
});

$("#sair").addEventListener("click", async () => {
  await sair();
  location.hash = "#login";
});

/* ---------- Área dos presidentes: eventos (criar, listar, editar e excluir) ---------- */
const formEvento = $("#form-evento"),
  erroEvento = $("#erro-evento"),
  sucessoEvento = $("#sucesso-evento");
let editandoId = null; // id do evento que está sendo editado (null = criando um novo)

function limparEdicao() {
  editandoId = null;
  formEvento.reset();
  erroEvento.textContent = "";
  $("#titulo-form").textContent = "Novo evento";
  $("#salvar-evento").textContent = "Publicar evento";
  $("#cancelar-edicao").hidden = true;
}

function editarEvento(e) {
  editandoId = e.id;
  ["titulo", "data", "hora", "local", "descricao"].forEach(
    (campo) => (formEvento.elements[campo].value = e[campo]),
  );
  $("#titulo-form").textContent = "Editar evento";
  $("#salvar-evento").textContent = "Salvar alterações";
  $("#cancelar-edicao").hidden = false;
  formEvento.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function excluirEvento(e) {
  if (!confirm(`Excluir o evento "${e.titulo}"?`)) return;
  const r = await rest("eventos?id=eq." + encodeURIComponent(e.id), {
    metodo: "DELETE",
    logado: true,
  });
  if (r.status === 401) return (location.hash = "#login");
  if (editandoId === e.id) limparEdicao();
  mostrarEventos();
}

function listarEventosAdmin(eventos) {
  const lista = $("#eventos-admin"),
    hoje = dataDeHoje();
  lista.replaceChildren();
  if (!eventos.length)
    return lista.append(criar("p", "lead", "Nenhum evento publicado."));

  [...eventos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((e) => {
      const item = criar("div", "request");
      item.append(
        criar(
          "p",
          "request-info",
          `${e.titulo}\n${e.data.split("-").reverse().join("/")} às ${e.hora}, ${e.local}` +
            (e.data < hoje ? "\nJá aconteceu" : ""),
        ),
      );

      const editar = criar("button", "pill", "Editar"),
        excluir = criar("button", "pill", "Excluir");
      editar.addEventListener("click", () => editarEvento(e));
      excluir.addEventListener("click", () => excluirEvento(e));
      item.append(editar, excluir);
      lista.append(item);
    });
}

formEvento.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(formEvento));
  erroEvento.textContent = "";

  if (["titulo", "data", "hora", "local"].some((campo) => !d[campo].trim()))
    return (erroEvento.textContent = "Preencha título, data, horário e local.");

  const editando = !!editandoId;
  const dados = {
    titulo: d.titulo.trim(),
    data: d.data,
    hora: d.hora,
    local: d.local.trim(),
    descricao: d.descricao.trim(),
  };
  const r = editando
    ? await rest("eventos?id=eq." + encodeURIComponent(editandoId), {
        metodo: "PATCH",
        corpo: dados,
        logado: true,
      })
    : await rest("eventos", { metodo: "POST", corpo: dados, logado: true });

  if (r.status === 401) return (location.hash = "#login");
  if (!r.ok)
    return (erroEvento.textContent =
      "Não foi possível salvar. Confira os dados (título com 3+ letras, local com 2+).");

  limparEdicao();
  await mostrarEventos();
  avisar(
    sucessoEvento,
    editando
      ? "Evento atualizado!"
      : "Evento publicado! Ele já aparece na seção Eventos.",
  );
});

$("#cancelar-edicao").addEventListener("click", limparEdicao);

/* ---------- Área dos presidentes: cadastros recebidos ---------- */
function criar(tag, classe, conteudo) {
  // cria elementos com textContent, nunca com HTML
  const el = document.createElement(tag);
  el.className = classe;
  if (conteudo) el.textContent = conteudo;
  return el;
}

async function mostrarCadastros() {
  const r = await rest("cadastros?select=*&order=criado_em.desc", {
    logado: true,
  });
  if (r.status === 401) return (location.hash = "#login");

  const lista = $("#cadastros");
  lista.replaceChildren();
  if (!r.dados?.length)
    return lista.append(criar("p", "lead", "Nenhum cadastro recebido."));

  r.dados.forEach((c) => {
    const item = criar("div", "request");
    item.append(
      criar(
        "p",
        "request-info",
        [
          c.nome,
          `CPF ${c.cpf} · Nascimento ${c.nascimento.split("-").reverse().join("/")}`,
          `${c.email} · ${c.tel}`,
          `${c.carro} (${c.ano})`,
          `Status: ${c.status}`,
        ].join("\n"),
      ),
    );

    if (c.status === "pendente")
      [
        ["aprovado", "Aprovar"],
        ["recusado", "Recusar"],
      ].forEach(([status, rotulo]) => {
        const botao = criar("button", "pill", rotulo);
        botao.addEventListener("click", async () => {
          await rest("cadastros?id=eq." + encodeURIComponent(c.id), {
            metodo: "PATCH",
            corpo: { status },
            logado: true,
          });
          mostrarCadastros();
        });
        item.append(botao);
      });

    const excluir = criar("button", "pill", "Excluir");
    excluir.addEventListener("click", async () => {
      if (
        !confirm(
          `Excluir o cadastro de ${c.nome}? Os dados serão apagados para sempre.`,
        )
      )
        return;
      await rest("cadastros?id=eq." + encodeURIComponent(c.id), {
        metodo: "DELETE",
        logado: true,
      });
      mostrarCadastros();
    });
    item.append(excluir);
    lista.append(item);
  });
}

/* ---------- Navegação entre páginas ---------- */
const inicio = $("#home");
const paginas = {
  "#associe-se": $("#inscricao"),
  "#privacidade": $("#privacidade"),
  "#login": $("#login"),
  "#publicar-evento": $("#publicar"),
};

async function trocarPagina() {
  const hash = location.hash;

  // A área dos presidentes só abre com login. O banco também confere a cada pedido.
  if (hash === "#publicar-evento" || hash === "#login") {
    const logado = await estaLogado();
    if (hash === "#publicar-evento" && !logado)
      return (location.hash = "#login");
    if (hash === "#login" && logado)
      return (location.hash = "#publicar-evento");
  }

  const pagina = paginas[hash] || inicio;
  [inicio, ...Object.values(paginas)].forEach((p) => (p.hidden = p !== pagina));
  pagina.classList.remove("pop");
  void pagina.offsetWidth;
  pagina.classList.add("pop");

  const alvo = document.getElementById(hash.slice(1));
  if (alvo && pagina === inicio) alvo.scrollIntoView();
  else scrollTo({ top: 0, behavior: "instant" });

  if (hash === "#publicar-evento") {
    limparEdicao();
    mostrarEventos();
    mostrarCadastros();
  }
}
addEventListener("hashchange", trocarPagina);
trocarPagina();

/* ---------- Efeitos ligados ao scroll ---------- */
const menu = $("#nav"),
  progresso = $("#progress"),
  foto = $("#foto"),
  linha = $("#linha"),
  botaoTopo = $("#topo-btn");
let ultimoY = 0;

addEventListener(
  "scroll",
  () => {
    const y = scrollY;
    const total = document.documentElement.scrollHeight - innerHeight;

    progresso.style.transform = `scaleX(${y / total})`;
    menu.classList.toggle("scrolled", y > 20);
    menu.classList.toggle("hidden", y > ultimoY && y > 300); // some ao descer, volta ao subir
    botaoTopo.classList.toggle("show", y > 700);
    ultimoY = y;

    foto.style.setProperty("--shift", Math.min(y * 0.12, 70)); // a imagem do topo desliza ao rolar

    const r = linha.getBoundingClientRect(); // linha do tempo "desenha" ao rolar
    linha.style.setProperty(
      "--progress",
      Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height)),
    );
  },
  { passive: true },
);

botaoTopo.addEventListener("click", () => scrollTo({ top: 0 }));

/* Sublinha no menu a seção que está na tela */
const secoes = new IntersectionObserver(
  (entradas) => {
    entradas
      .filter((e) => e.isIntersecting)
      .forEach(({ target }) =>
        $$(".links a").forEach((a) =>
          a.classList.toggle("active", a.hash === "#" + target.id),
        ),
      );
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
["historia", "eventos", "presidentes", "faq"].forEach((id) =>
  secoes.observe(document.getElementById(id)),
);

/* ---------- Botões "magnéticos": puxam levemente em direção ao mouse ---------- */
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  $$(".btn").forEach((botao) => {
    botao.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = botao.getBoundingClientRect();
      botao.style.setProperty(
        "--mx",
        (e.clientX - r.left - r.width / 2) * 0.18 + "px",
      );
      botao.style.setProperty(
        "--my",
        (e.clientY - r.top - r.height / 2) * 0.3 + "px",
      );
    });
    botao.addEventListener("pointerleave", () => {
      botao.style.removeProperty("--mx");
      botao.style.removeProperty("--my");
    });
  });
}
