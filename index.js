let cors = require("cors");
let express = require("express");
let mysql = require("serverless-mysql");

let app = express();
let PORT = 3000;

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

    if (isNaN(pagina) || pagina <= 0) {
        return res.status(400).json({
            mensagem: "Página inválida!"
        });
    }

    let filmes = await bd.query(
        `SELECT * FROM filmes LIMIT ?, ?`, [(pagina - 1) * limite, limite]);
    if (!filmes.length) {
        return res.status(404).json({
            mensagem: "Página não encontrada!"
        });
    }

    res.json(filmes);
});

app.get("/filme/:id", async (req, res) => {
    let id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            mensagem: "ID inválido!"
        });
    }

    let filmes = await bd.query(`SELECT * FROM filmes WHERE id = ?`, [id]);

    if (!filmes.length) {
        return res.status(404).json({
            mensagem: "Filme não encontrado!",
        });
    }

    let filme = filmes[0];

    let atores = await bd.query(`
        SELECT a.titulo AS nome_ator
        FROM atores a
        JOIN atores_filmes af ON a.id = af.ator_id
        WHERE af.filme_id = ?`, [id]);

    let generos = await bd.query(`
        SELECT g.titulo AS genero
        FROM generos g
        JOIN filmes_generos fg ON g.id = fg.genero_id
        WHERE fg.filme_id = ?`, [id]);

    let resultado = {
        filme: filme.titulo,
        ano: filme.ano,
        duracao: filme.duracao,
        sinopse: filme.sinopse,
        nota: filme.nota,
        votos: filme.votos,
        imdb_id: filme.imdb_id,
        poster: filme.poster,
        generos: generos.map(genero => genero.genero),
        atores: atores.map(ator => ator.nome_ator)
    };

    res.json(resultado);
});

app.get("/filmes/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra;
    let resultados = await bd.query(
        `SELECT id, titulo, ano, duracao, sinopse, nota, votos, imdb_id FROM filmes WHERE titulo LIKE ?`, [`%${palavra}%`]);

    if (!resultados.length) {
        return res.status(404).json({
            mensagem: "Filme não encontrado."
        });
    }

    let resultado = [];

    for (let filme of resultados) {
        let atores = await bd.query(`
            SELECT a.titulo AS nome_ator
            FROM atores a
            JOIN atores_filmes af ON a.id = af.ator_id
            WHERE af.filme_id = ?`, [filme.id]);

        let generos = await bd.query(
            `SELECT g.titulo AS genero
            FROM generos g
            JOIN filmes_generos fg ON g.id = fg.genero_id
            WHERE fg.filme_id = ?`, [filme.id]
        );

        resultado.push({
            filme: filme.titulo,
            ano: filme.ano,
            duracao: filme.duracao,
            sinopse: filme.sinopse,
            nota: filme.nota,
            votos: filme.votos,
            imdb_id: filme.imdb_id,
            generos: generos.map(genero => genero.genero),
            atores: atores.map(ator => ator.nome_ator)
        });
    }

    res.status(200).json({
        filmes: resultado
    });
});

app.get("/generos/:genero", async (req, res) => {
    let genero = req.params.genero;
    let filmes = await bd.query(
        `SELECT 
            f.id,
            f.titulo
        FROM filmes f
        INNER JOIN filmes_generos fg ON f.id = fg.filme_id
        INNER JOIN generos g ON fg.genero_id = g.id
        WHERE g.titulo = ?
        ORDER BY f.ano DESC`, [genero]);

    res.json(filmes);
    await bd.end();
});

app.get("/ator/:id", async (req, res) => {
    let id = parseInt(req.params.id);

    let atores = await bd.query(
        `SELECT * FROM atores WHERE id = ?`,
        [id]);
    let ator = atores[0];
    let filmes = await bd.query(`
        SELECT f.titulo AS filme
        FROM filmes f
        JOIN atores_filmes af ON f.id = af.filme_id
        WHERE af.ator_id = ?`, [id]);

    let resultado = {
        ator: ator.titulo,
        filmes: filmes.map(f => f.filme)
    };

    res.json(resultado);
});

app.get("/atores/busca/:palavra", async (req, res) => {
    let palavra = req.params.palavra;

    let atores = await bd.query(
        `SELECT 
            a.id AS atorId, 
            a.titulo AS ator
        FROM atores a
        WHERE a.titulo LIKE ?;`,
        [`%${palavra}%`]);
    if (!atores.length) {
        return res.status(404).json({
            message: "Nenhum ator encontrado!"
        });
    }

    let resultado = [];
    for (let ator of atores) {
        let filmes = await bd.query(
            `SELECT 
                    f.titulo AS filme
                FROM filmes f
                JOIN atores_filmes af ON f.id = af.filme_id
                WHERE af.ator_id = ?;`,
            [ator.atorId]);

        resultado.push({
            ator: ator.ator,
            filmes: filmes.map(f => f.filme)
        });
    }
    res.json(resultado);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
});

app.post("/atores", async (req, res) => {
    let {
        titulo
    } = req.body;

    if (!titulo || titulo.trim() === "") {
        return res.status(400).json({
            mensagem: "O nome do ator é OBRIGATÓRIO."
        });
    }

    let ator_já_adicionado = await bd.query(
        `SELECT * FROM atores WHERE titulo = ?`,
        [titulo]);

    if (ator_já_adicionado.length > 0) {
        return res.status(400).json({
            mensagem: `Ator já adicionado! ID: ${ator_já_adicionado[0].id}`
        });
    }

    let adicionar = await bd.query(
        `INSERT INTO atores (titulo) VALUES (?)`,
        [titulo]);

    return res.status(201).json({
        mensagem: `Ator adicionado com sucesso! ID: ${adicionar.insertId}`
    });
});

app.post("/participacoes/:idAtor/:idFilme", async (req, res) => {
    let idAtor = parseInt(req.params.idAtor);
    let idFilme = parseInt(req.params.idFilme);

    let ator = await bd.query(
        `SELECT id FROM atores WHERE id = ?`,
        [idAtor]);

    if (!ator.length) {
        return res.status(404).json({
            mensagem: `Ator ${idAtor} não encontrado.`
        });
    }

    let filme = await bd.query(
        `SELECT id FROM filmes WHERE id = ?`,
        [idFilme]);

    if (!filme.length) {
        return res.status(404).json({
            mensagem: `Filme ${idFilme} não encontrado.`
        });
    }

    let participacao = await bd.query(
        `SELECT * FROM atores_filmes WHERE ator_id = ? AND filme_id = ?`,
        [idAtor, idFilme]);

    if (participacao.length > 0) {
        return res.status(409).json({
            mensage: `Participação já existente. ID: ${participacao[0].id}`
        });
    }

    let adicionar = await bd.query(
        `INSERT INTO atores_filmes (ator_id, filme_id) VALUES (?, ?)`,
        [idAtor, idFilme]);
    await bd.end();

    return res.status(200).json({
        mensagem: `Participação adicionada. ID: ${adicionar.insertId}`
    });
});

app.put("/atores/:id", async (req, res) => {
    let id = parseInt(req.params.id);
    let {
        titulo
    } = req.body;

    if (!titulo || titulo.trim() === "") {
        return res.status(400).json({
            mensagem: "Nome do ator é OBRIGATÓRIO."
        });
    }

    let ator_existe = await bd.query(
        `SELECT * FROM atores WHERE id = ?`,
        [id]);

    if (!ator_existe.length) {
        return res.status(404).json({
            mensagem: "Ator não encontrado."
        });
    }

    await bd.query(
        `UPDATE atores SET titulo = ? WHERE id = ?`,
        [titulo, id]);

    return res.status(200).json({
        mensagem: `Ator atualizado! ID: ${id}`
    });
});

app.delete("/atores/:id", async (req, res) => {
    let id = parseInt(req.params.id);
    let ator_existe = await bd.query(
        `SELECT * FROM atores WHERE id = ?`,
        [id]);

    if (!ator_existe.length) {
        return res.status(404).json({
            mensagem: `ID ${id} não encontrado.`
        });
    }

    await bd.query(
        `DELETE FROM atores_filmes WHERE ator_id = ?`,
        [id]);

    await bd.query(
        `DELETE FROM atores WHERE id = ?`,
        [id]);

    return res.status(200).json({
        mensagem: `Ator ${id} removido.`
    });
})

app.delete("/participacoes/:idAtor/:idFilme", async (req, res) => {
    let idAtor = parseInt(req.params.idAtor);
    let idFilme = parseInt(req.params.idFilme);

    let participacao = await bd.query(
        `SELECT * FROM atores_filmes WHERE ator_id = ? AND filme_id = ?`,
        [idAtor, idFilme]
    );
    if (!participacao.length) {
        return res.status(404).json({
            mensagem: "Participação não encontrada."
        })
    }

    await bd.query(`
        DELETE FROM atores_filmes WHERE ator_id = ? AND filme_id = ?`,
        [idAtor, idFilme]);

    return res.status(200).json({
        mensagem: `Participação removida. ID: ${participacao[0].id}`
    });
})