let cors = require("cors");
let express = require("express");
let mysql = require("serverless-mysql");

const app = express();
const porta = 3000;

app.use(cors());
app.use(express.json());

let bd = mysql({
    config: {
        host: "127.0.0.1",
        database: "iftm_filmes",
        user: "root",
        password: "",
    },
});

app.get("/filmes/:pagina", async (req, res) => {
    let pagina = parseInt(req.params.pagina);
    let limite = 10;
    let offset = (pagina - 1) * limite;

    let filmes = await bd.query(`SELECT * FROM filmes LIMIT ?, ?`, [
        offset,
        limite,
    ]);

    if (filmes.length === 0) {
        res.status(404).json({ mensagem: "Página não encontrado!" });
        return;
    }

    res.json(filmes);
    await bd.end();
});

app.get("/filme/:id", async (req, res) => {
    let id = req.params.id;
    let filme = await bd.query(`SELECT * FROM filmes WHERE id = ?`, [id]);

    if (filme.length === 0) {
        res.status(404).json({ mensagem: "Filme não encontrado!" });
        return;
    }

    res.json(filme);
    await bd.end();
});

app.get("/filmes/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra;
    let resultados = await bd.query(`
        SELECT 
            f.titulo AS filme,
            f.sinopse AS sinopse,
            g.titulo AS genero,
            a.titulo AS ator
        FROM filmes f
        LEFT JOIN filmes_generos fg ON f.id = fg.filme_id
        LEFT JOIN generos g ON fg.genero_id = g.id
        LEFT JOIN atores_filmes af ON f.id = af.filme_id
        LEFT JOIN atores a ON af.ator_id = a.id
        WHERE 
            f.titulo LIKE ? OR f.sinopse LIKE ? OR g.titulo LIKE ? OR a.titulo LIKE ?;`,
        [`%${palavra}%`, `%${palavra}%`, `%${palavra}%`, `%${palavra}%`]);

    if (resultados.length === 0) {
        return res.status(404).json({ message: "Nenhum resultado encontrado!" });
    }

    res.json(resultados);
    await bd.end();
});

app.get("/generos/:genero", async (req, res) => {
    let genero = req.params.genero;
    let filmes = await bd.query(`
        SELECT 
            f.id,
            f.titulo,
            f.ano,
            f.sinopse
        FROM filmes f
        INNER JOIN filmes_generos fg ON f.id = fg.filme_id
        INNER JOIN generos g ON fg.genero_id = g.id
        WHERE g.titulo = ?
        ORDER BY f.ano DESC`, [genero]);

    res.json(filmes);
    await bd.end();
});

app.get("/ator/:id", async (req, res) => {
    let id = req.params.id;
    let ator = await bd.query(`SELECT * FROM atores WHERE id = ?`, [id]);

    res.json(ator);
    await bd.end();
});

app.get("/atores/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra;
    let atores = await bd.query(`
        SELECT 
            a.titulo AS ator, f.titulo AS filme
        FROM atores a
        JOIN atores_filmes af ON a.id = af.ator_id
        JOIN filmes f ON f.id = af.filme_id
        WHERE a.titulo LIKE ? OR f.titulo LIKE ?;`, [`%${palavra}%`, `%${palavra}%`]);
    // %% é o coringa para buscar qualquer coisa antes e depois da palavra

    if (atores.length === 0) {
        return res.status(404).json({ message: "Nenhum resultado encontrado!" });
    }

    res.json(atores);
    await bd.end();
});

app.listen(porta, () => {
    console.log(`Servidor rodando em http://127.0.0.1:${porta}`);
});

app.post("/atores", async (req, res) => {
    let { titulo } = req.body;

    if (!titulo || titulo.trim() === "") {
        return res.status(400).json({ mensagem: `Digite o nome do ator para adicioná-lo.` });
    } 

    let ator_já_adicionado = await bd.query(
        `SELECT * FROM atores WHERE titulo = ?`, [titulo]);
    
    if (ator_já_adicionado.length > 0) {
        return res.status(400).json({ mensagem: `Ator já adicionado! ID: ${ator_já_adicionado[0].id}` });
    }

    let adicionar = await bd.query(
        `INSERT INTO atores (titulo) VALUES (?)`,[titulo]);
    await bd.end();
    return res.status(201).json({mensagem: `Ator adicionado com sucesso! ID: ${adicionar.insertId}`,});
});
