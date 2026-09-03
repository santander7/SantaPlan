var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configuracion de CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontendLocal",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:3000") // Puertos comunes de Vite y React
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Habilitar la politica de CORS
app.UseCors("AllowFrontendLocal");

app.UseAuthorization();

app.MapControllers();

app.Run();
